/**
 * Expired Market Sweeper
 *
 * Periodically scans ALL markets on the factory and auto-resolves any that
 * are ACTIVE but past their end date. Catches markets that were never added
 * to the ResolutionQueue (created before the queue, or after a service restart
 * that lost queue state).
 *
 * Runs on startup + every 2 minutes.
 */

import { ethers } from "ethers";
import { getBaseSepoliaRpcUrl, getBetFactoryAddress, getPrivateKey } from "../config.js";
import { AutoResolver } from "./AutoResolver.js";

async function withRetry<T>(fn: () => Promise<T>, retries = 4, baseDelayMs = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isRateLimit =
        e?.info?.error?.code === -32016 ||
        e?.message?.includes("over rate limit") ||
        e?.message?.includes("rate limit");
      if (isRateLimit && i < retries - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

const FACTORY_ABI = [
  "function allBets(uint256 index) view returns (address)",
  "function getBetCount() view returns (uint256)",
];

const BET_ABI = [
  "function status() view returns (uint8)",
  "function endDate() view returns (uint256)",
  "function title() view returns (string)",
];

// BetStatus enum
const ACTIVE = 0;

export class ExpiredMarketSweeper {
  private provider: ethers.JsonRpcProvider;
  private factory: ethers.Contract;
  private autoResolver: AutoResolver;
  private intervalHandle: NodeJS.Timeout | null = null;
  private running = false;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(getBaseSepoliaRpcUrl());
    this.factory = new ethers.Contract(getBetFactoryAddress(), FACTORY_ABI, this.provider);
    this.autoResolver = new AutoResolver();
  }

  public start(): void {
    console.log("[Sweeper] Starting expired market sweeper (every 2 min)...");

    // Delay startup sweep to avoid RPC rate limits during service initialization
    setTimeout(() => {
      this.sweep().catch(e => console.error("[Sweeper] Startup sweep error:", e));
    }, 15_000);

    // Then every 2 minutes
    this.intervalHandle = setInterval(() => {
      this.sweep().catch(e => console.error("[Sweeper] Sweep error:", e));
    }, 2 * 60 * 1000);
  }

  public stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async sweep(): Promise<void> {
    if (this.running) return; // Prevent overlap
    this.running = true;

    try {
      const count = await withRetry(() => this.factory.getBetCount());
      const total = Number(count);
      if (total === 0) return;

      const now = Math.floor(Date.now() / 1000);
      const expired: { address: string; title: string }[] = [];

      // Fetch in small batches with delay to avoid RPC rate limits
      const BATCH = 5;
      for (let i = 0; i < total; i += BATCH) {
        const end = Math.min(i + BATCH, total);
        const batch = await withRetry(() =>
          Promise.all(
            Array.from({ length: end - i }, (_, j) =>
              this.factory.allBets(i + j)
            )
          )
        );

        // Small delay between address batches
        if (i > 0) await new Promise(r => setTimeout(r, 500));

        const checks = await Promise.all(
          batch.map(async (addr: string) => {
            try {
              const bet = new ethers.Contract(addr, BET_ABI, this.provider);
              const [status, endDate, title] = await withRetry(() =>
                Promise.all([bet.status(), bet.endDate(), bet.title()])
              );
              // Explicit type check — avoid Number(null) === 0 false-positive
              if (status === null || status === undefined) return null;
              const isExpired = Number(status) === ACTIVE && Number(endDate) < now;
              return isExpired ? { address: addr, title } : null;
            } catch {
              return null;
            }
          })
        );

        for (const hit of checks) {
          if (hit) expired.push(hit);
        }
      }

      if (expired.length === 0) return;

      console.log(`[Sweeper] Found ${expired.length} expired market(s) to resolve`);

      // Resolve sequentially to avoid nonce collisions
      for (const { address, title } of expired) {
        try {
          console.log(`[Sweeper] Resolving: ${title} (${address})`);
          await this.autoResolver.resolveMarket(address, title);
          console.log(`[Sweeper] Resolved: ${title}`);
        } catch (err: any) {
          // "not ACTIVE" or "already resolving" — not a real error
          if (!err.message?.includes('not in ACTIVE')) {
            console.error(`[Sweeper] Failed to resolve ${address}: ${err.message}`);
          }
        }
        // Small delay between txs to avoid nonce collision
        await new Promise(r => setTimeout(r, 3000));
      }
    } finally {
      this.running = false;
    }
  }
}
