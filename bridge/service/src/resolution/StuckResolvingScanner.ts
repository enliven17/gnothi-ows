/**
 * Stuck Resolving Scanner
 *
 * Detects markets that are in RESOLVING state but have no oracle deployed
 * (e.g. bridge service was down when the ResolutionRequested event fired,
 * or the event was older than the EvmToGenLayer lookback window).
 *
 * On each sweep it reads factory.resolvingBets(), cross-references
 * OracleRegistry, and re-deploys the oracle for any that are missing.
 *
 * Runs on startup + every 5 minutes.
 */

import { ethers, AbiCoder } from "ethers";

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
import { getBaseSepoliaRpcUrl, getBetFactoryAddress, getBridgeSenderAddress, getPrivateKey } from "../config.js";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getGenlayerRpcUrl } from "../config.js";
import { getOracle, recordOracle } from "./OracleRegistry.js";
import { readFileSync } from "fs";
import path from "path";

const BASE_SEPOLIA_LZ_EID = 40245;
const RESOLVING = 1;

const FACTORY_ABI = [
  "function resolvingBets(uint256 index) view returns (address)",
  "function getResolvingBetCount() view returns (uint256)",
];

const BET_ABI = [
  "function status() view returns (uint8)",
  "function title() view returns (string)",
  "function sideAName() view returns (string)",
  "function sideBName() view returns (string)",
  "function resolutionData() view returns (bytes)",
  "function resolutionType() view returns (uint8)",
  "function resolutionRequestedAt() view returns (uint256)",
];

const ORACLE_CONTRACTS: Record<number, string> = {
  0: "crypto_prediction_market.py",
  1: "stock_prediction_market.py",
  2: "news_pm.py",
};

function decodeResolutionData(data: string): [string, string] | null {
  if (!data || data === "0x") return null;
  try {
    const [p1, p2] = AbiCoder.defaultAbiCoder().decode(["string", "string"], data);
    return [p1, p2];
  } catch {
    return null;
  }
}

export class StuckResolvingScanner {
  private provider: ethers.JsonRpcProvider;
  private factory: ethers.Contract;
  private genLayerClient: any;
  private intervalHandle: NodeJS.Timeout | null = null;
  private running = false;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(getBaseSepoliaRpcUrl());
    this.factory = new ethers.Contract(getBetFactoryAddress(), FACTORY_ABI, this.provider);

    const account = createAccount(`0x${getPrivateKey().replace(/^0x/, "")}`);
    this.genLayerClient = createClient({
      chain: {
        ...studionet,
        rpcUrls: { default: { http: [getGenlayerRpcUrl()] } },
      },
      account,
    });
  }

  public start(): void {
    console.log("[StuckScanner] Starting stuck-resolving scanner (every 5 min)...");
    // Delay startup scan to avoid RPC rate limits during service initialization
    setTimeout(() => {
      this.scan().catch(e => console.error("[StuckScanner] Startup scan error:", e));
    }, 30_000);
    this.intervalHandle = setInterval(() => {
      this.scan().catch(e => console.error("[StuckScanner] Scan error:", e));
    }, 5 * 60 * 1000);
  }

  public stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async scan(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      let count: bigint;
      try {
        count = await withRetry(() => this.factory.getResolvingBetCount());
      } catch {
        // Factory may not have this method on older deployments
        return;
      }

      const total = Number(count);
      if (total === 0) return;

      console.log(`[StuckScanner] Checking ${total} resolving market(s)...`);

      const addresses: string[] = await withRetry(() =>
        Promise.all(
          Array.from({ length: total }, (_, i) => this.factory.resolvingBets(i))
        )
      );

      for (const addr of addresses) {
        try {
          await this.checkAndRedeploy(addr);
        } catch (e: any) {
          console.error(`[StuckScanner] Error checking ${addr}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    } finally {
      this.running = false;
    }
  }

  private async checkAndRedeploy(addr: string): Promise<void> {
    // Already has an oracle registered?
    const existing = await getOracle(addr);
    if (existing?.txHash) {
      return; // Oracle already deployed, bridge will pick it up
    }

    // Read market data from contract
    const bet = new ethers.Contract(addr, BET_ABI, this.provider);
    const [status, title, sideAName, sideBName, resolutionData, resolutionType, requestedAt] =
      await withRetry(() =>
        Promise.all([
          bet.status(),
          bet.title(),
          bet.sideAName(),
          bet.sideBName(),
          bet.resolutionData(),
          bet.resolutionType(),
          bet.resolutionRequestedAt(),
        ])
      );

    if (Number(status) !== RESOLVING) return;

    const decoded = decodeResolutionData(resolutionData);
    if (!decoded) {
      console.warn(`[StuckScanner] Could not decode resolution data for ${addr}`);
      return;
    }

    const [field1, field2] = decoded;
    const resType = Number(resolutionType);
    const oracleFile = ORACLE_CONTRACTS[resType];
    if (!oracleFile) {
      console.warn(`[StuckScanner] Unknown resolution type ${resType} for ${addr}`);
      return;
    }

    const staleMins = Math.round((Date.now() / 1000 - Number(requestedAt)) / 60);
    console.log(`[StuckScanner] Re-deploying oracle for: ${title} (stuck ${staleMins} min)`);

    // Load oracle code
    const oraclesBasePath = process.env.ORACLES_PATH || path.join(process.cwd(), "intelligent-oracles");
    const code = readFileSync(path.join(oraclesBasePath, oracleFile), "utf-8");

    const args = [
      addr, field1, field2, title, sideAName, sideBName,
      getBridgeSenderAddress(), BASE_SEPOLIA_LZ_EID, getBetFactoryAddress(),
    ];

    // Record immediately so we don't double-deploy
    await recordOracle(addr, "pending", "");

    try {
      const hash = await this.genLayerClient.deployContract({ code, args, leaderOnly: false });
      console.log(`[StuckScanner] Oracle TX: ${hash}`);
      await recordOracle(addr, hash, "");

      const receipt = await this.genLayerClient.waitForTransactionReceipt({
        hash, status: "ACCEPTED", retries: 60, interval: 3000,
      });

      const oracleAddress = receipt?.data?.contract_address ?? "";
      await recordOracle(addr, hash, oracleAddress);
      console.log(`[StuckScanner] Oracle deployed: ${oracleAddress} for ${title}`);
    } catch (e: any) {
      // Clear the "pending" record so next scan retries
      await recordOracle(addr, "", "");
      console.error(`[StuckScanner] Deploy failed for ${addr}: ${e.message}`);
    }
  }
}
