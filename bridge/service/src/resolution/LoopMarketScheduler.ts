/**
 * LoopMarketScheduler
 *
 * Creates self-renewing 5-minute direction markets for BTC and ETH.
 * Flow per cycle:
 *   1. Fetch current price from CoinGecko
 *   2. Create a CRYPTO market: "BTC/USD: UP or DOWN? (Open: $X)"
 *   3. Wait 5 min + 10s buffer
 *   4. Call resolve() — bridge wallet is the creator, so auth is never an issue
 *   5. Immediately start next cycle
 *
 * The existing crypto_prediction_market.py oracle handles resolution:
 * the LLM reads the start price from the market title and compares to current price.
 */

import { ethers, AbiCoder } from "ethers";
import { getBaseSepoliaRpcUrl, getPrivateKey, getBetFactoryAddress } from "../config.js";
import { AutoResolver } from "./AutoResolver.js";
import type { ResolutionQueue } from "./ResolutionQueue.js";

const LOOP_DURATION_SECONDS = 5 * 60; // 5 minutes
const RESOLUTION_BUFFER_SECONDS = 15;  // wait a bit after deadline before calling resolve()
const RETRY_DELAY_SECONDS = 30;

const BET_FACTORY_ABI = [
  "function createBet(string title, string resolutionCriteria, string sideAName, string sideBName, uint256 endDate, uint8 resolutionType, bytes resolutionData) external",
  "event BetCreated(address indexed betAddress, address indexed creator, string title, uint256 endDate)",
];

interface LoopConfig {
  symbol: string;     // "BTC"
  geckoId: string;    // "bitcoin"  — used for CoinGecko API + oracle resolution
}

const LOOP_TOKENS: LoopConfig[] = [
  { symbol: "BTC", geckoId: "bitcoin" },
  { symbol: "ETH", geckoId: "ethereum" },
];

export interface ActiveLoopMarket {
  symbol: string;
  contractAddress: string;
  openPrice: number;
  endDate: Date;
  cycle: number;
}

export class LoopMarketScheduler {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private factory: ethers.Contract;
  private autoResolver: AutoResolver;
  private resolutionQueue: ResolutionQueue;
  private active = new Map<string, ActiveLoopMarket>();
  private running = false;

  constructor(resolutionQueue: ResolutionQueue) {
    this.provider = new ethers.JsonRpcProvider(getBaseSepoliaRpcUrl());
    this.wallet = new ethers.Wallet(getPrivateKey(), this.provider);
    this.factory = new ethers.Contract(getBetFactoryAddress(), BET_FACTORY_ABI, this.wallet);
    this.autoResolver = new AutoResolver();
    this.resolutionQueue = resolutionQueue;
  }

  // ── Price fetch ────────────────────────────────────────────────────────────

  private async fetchPrice(geckoId: string): Promise<number> {
    // Primary: CoinGecko
    const geckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`;
    try {
      const resp = await fetch(geckoUrl);
      if (resp.ok) {
        const data = await resp.json() as Record<string, { usd: number }>;
        const price = data[geckoId]?.usd ?? 0;
        if (price > 0) return price;
        console.warn(`[LoopMarket] CoinGecko returned empty price for ${geckoId}, status=${resp.status}`);
      } else {
        console.warn(`[LoopMarket] CoinGecko HTTP ${resp.status} for ${geckoId}`);
      }
    } catch (err) {
      console.error(`[LoopMarket] CoinGecko fetch error for ${geckoId}:`, err);
    }

    // Fallback: Binance (free, no key required)
    const symbolMap: Record<string, string> = { bitcoin: "BTCUSDT", ethereum: "ETHUSDT" };
    const binanceSymbol = symbolMap[geckoId];
    if (binanceSymbol) {
      try {
        const resp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
        if (resp.ok) {
          const data = await resp.json() as { price: string };
          const price = parseFloat(data.price);
          if (price > 0) {
            console.log(`[LoopMarket] Using Binance price for ${geckoId}: $${price}`);
            return price;
          }
        }
      } catch (err) {
        console.error(`[LoopMarket] Binance fetch error for ${geckoId}:`, err);
      }
    }

    return 0;
  }

  // ── Market creation ────────────────────────────────────────────────────────

  private async createMarket(config: LoopConfig, cycle: number): Promise<ActiveLoopMarket | null> {
    const openPrice = await this.fetchPrice(config.geckoId);
    if (!openPrice) {
      console.error(`[LoopMarket] Cannot create market — price fetch failed for ${config.symbol}`);
      return null;
    }

    const endDate = Math.floor(Date.now() / 1000) + LOOP_DURATION_SECONDS;
    const priceStr = openPrice.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const title = `${config.symbol}/USD: UP or DOWN? (Open: $${priceStr})`;
    const resolutionCriteria =
      `Resolves UP if ${config.symbol} price is higher than $${openPrice.toFixed(2)} at market close, DOWN otherwise.`;

    const abiCoder = AbiCoder.defaultAbiCoder();
    const resolutionData = abiCoder.encode(["string", "string"], [config.symbol, config.geckoId]);

    try {
      console.log(`[LoopMarket] Creating ${config.symbol} market #${cycle} — open $${priceStr}`);
      const tx = await this.factory.createBet(
        title,
        resolutionCriteria,
        "UP",
        "DOWN",
        endDate,
        0,              // ResolutionType.CRYPTO
        resolutionData,
      );
      const receipt = await tx.wait();

      // Parse BetCreated event to get the new contract address
      let betAddress: string | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = this.factory.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === "BetCreated") {
            betAddress = parsed.args[0] as string;
            break;
          }
        } catch { /* skip */ }
      }

      if (!betAddress) throw new Error("BetCreated event not found in receipt");

      console.log(`[LoopMarket] ${config.symbol} #${cycle} created: ${betAddress}`);
      return {
        symbol: config.symbol,
        contractAddress: betAddress,
        openPrice,
        endDate: new Date(endDate * 1000),
        cycle,
      };
    } catch (err: any) {
      // Nonce collision: wallet sent concurrent txs — wait and retry once
      if (err.code === 'NONCE_EXPIRED' || err.message?.includes('nonce')) {
        console.warn(`[LoopMarket] Nonce error for ${config.symbol}, retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5_000));
        return this.createMarket(config, cycle);
      }
      console.error(`[LoopMarket] Failed to create ${config.symbol} market:`, err.message);
      return null;
    }
  }

  // ── Cycle management ───────────────────────────────────────────────────────

  private async runCycle(config: LoopConfig, cycle: number): Promise<void> {
    if (!this.running) return;

    const market = await this.createMarket(config, cycle);

    if (!market) {
      console.warn(`[LoopMarket] ${config.symbol} creation failed. Retrying in ${RETRY_DELAY_SECONDS}s...`);
      setTimeout(() => this.runCycle(config, cycle), RETRY_DELAY_SECONDS * 1000);
      return;
    }

    this.active.set(config.symbol, market);

    // Schedule resolution via ResolutionQueue (persists across restarts)
    const resolveAt = new Date(market.endDate.getTime() + RESOLUTION_BUFFER_SECONDS * 1000);
    this.resolutionQueue.addJob(
      market.contractAddress,
      resolveAt,
      `${config.symbol} Loop #${cycle}`,
    );

    // Start next cycle shortly after resolution is due
    const nextCycleDelay = resolveAt.getTime() - Date.now() + 10_000;
    setTimeout(async () => {
      if (!this.running) return;
      await this.runCycle(config, cycle + 1);
    }, nextCycleDelay);

    console.log(`[LoopMarket] ${config.symbol} #${cycle} active until ${market.endDate.toISOString()}, resolve queued at ${resolveAt.toISOString()}`);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log(`[LoopMarket] Starting ${LOOP_DURATION_SECONDS / 60}-minute loop markets (BTC, ETH)...`);
    // Sequential start: wait for each market to be created before starting the next
    // This avoids nonce collisions and CoinGecko rate limits
    for (const token of LOOP_TOKENS) {
      await this.runCycle(token, 1);
      await new Promise(r => setTimeout(r, 3_000)); // 3s gap between tokens
    }
  }

  public stop(): void {
    this.running = false;
    this.active.clear();
    console.log(`[LoopMarket] Stopped all loops`);
  }

  public getStatus(): ActiveLoopMarket[] {
    return Array.from(this.active.values());
  }
}
