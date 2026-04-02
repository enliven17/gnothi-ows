/**
 * EVM -> GenLayer Relay
 *
 * Polls for ResolutionRequested events from Base Sepolia BetFactoryCOFI
 * and deploys the appropriate oracle contract to GenLayer.
 *
 */

import { ethers, AbiCoder } from "ethers";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";
import path from "path";
import {
  getBaseSepoliaRpcUrl,
  getBetFactoryAddress,
  getGenlayerRpcUrl,
  getPrivateKey,
  getBridgeSenderAddress,
} from "../config.js";
import { recordOracle } from "../resolution/OracleRegistry.js";

const RESOLUTION_TYPES = ["CRYPTO", "STOCKS", "NEWS"];
const BASE_SEPOLIA_LZ_EID = 40245;

// Oracle contracts in local intelligent-oracles directory
const ORACLE_CONTRACTS: Record<number, string> = {
  0: "crypto_prediction_market.py",  // CRYPTO
  1: "stock_prediction_market.py",   // STOCKS
  2: "news_pm.py",                   // NEWS
};

const BET_FACTORY_ABI = [
  "event ResolutionRequested(address indexed betContract, address indexed creator, uint8 resolutionType, string title, string sideAName, string sideBName, bytes resolutionData, uint256 timestamp)",
];

function decodeResolutionData(data: string): [string, string] | null {
  if (!data || data === "0x") return null;
  try {
    const abiCoder = AbiCoder.defaultAbiCoder();
    const [param1, param2] = abiCoder.decode(["string", "string"], data);
    return [param1, param2];
  } catch {
    return null;
  }
}

export class EvmToGenLayerRelay {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private genLayerClient: any;
  private processedEvents: Set<string>;
  private lastBlock: number;
  private pollInterval: NodeJS.Timeout | null;

  constructor() {
    // EVM provider for Base Sepolia
    this.provider = new ethers.JsonRpcProvider(getBaseSepoliaRpcUrl());
    this.factoryContract = new ethers.Contract(
      getBetFactoryAddress(),
      BET_FACTORY_ABI,
      this.provider
    );

    // GenLayer client
    const privateKey = getPrivateKey();
    const account = createAccount(`0x${privateKey.replace(/^0x/, "")}`);
    this.genLayerClient = createClient({
      chain: {
        ...studionet,
        rpcUrls: {
          default: { http: [getGenlayerRpcUrl()] },
        },
      },
      account,
    });

    this.processedEvents = new Set<string>();
    this.lastBlock = 0;
    this.pollInterval = null;
  }

  private loadOracleCode(resolutionType: number): string {
    const filename = ORACLE_CONTRACTS[resolutionType];
    if (!filename) {
      throw new Error(`Unknown resolution type: ${resolutionType}`);
    }

    // Use environment variable or fallback to process.cwd() for Railway compatibility
    const oraclesBasePath = process.env.ORACLES_PATH || path.join(process.cwd(), "intelligent-oracles");
    const contractPath = path.join(oraclesBasePath, filename);

    console.log(`[EVM→GL] Loading oracle from: ${contractPath}`);
    return readFileSync(contractPath, "utf-8");
  }

  private async deployOracle(
    betContract: string,
    resolutionType: number,
    title: string,
    sideAName: string,
    sideBName: string,
    resolutionData: string
  ): Promise<string | null> {
    try {
      // Decode resolution data.
      // For CRYPTO/STOCKS: [tokenSymbol, tokenName] = [e.g. "BTC", "Bitcoin"]
      // For NEWS: tokenSymbol is repurposed as the market question,
      //           tokenName is repurposed as the evidence URL.
      //           The news_pm.py oracle reads these via its token_symbol/token_name constructor args.
      const decoded = decodeResolutionData(resolutionData);
      if (!decoded) {
        console.error("[EVM→GL] Failed to decode resolution data");
        return null;
      }
      // For CRYPTO/STOCKS: [tokenSymbol, tokenName] e.g. ["BTC", "Bitcoin"]
      // For NEWS: [question, evidenceUrl] — repurposed fields in the ABI encoding
      const [field1, field2] = decoded;
      const isNews = resolutionType === 2;

      const bridgeSender = getBridgeSenderAddress();
      const targetChainEid = BASE_SEPOLIA_LZ_EID;
      const targetContract = getBetFactoryAddress();

      // Oracle constructor expects (market_id, token_symbol, token_name, ...) for all types.
      // For NEWS the oracle re-interprets these as question/evidenceUrl internally.
      const args = [
        betContract, field1, field2, title, sideAName, sideBName,
        bridgeSender, targetChainEid, targetContract
      ];

      console.log(`[EVM→GL] Deploying oracle...`);
      console.log(`  Contract: ${ORACLE_CONTRACTS[resolutionType]}`);
      console.log(`  Market ID: ${betContract}`);
      if (isNews) {
        console.log(`  Question: ${field1}`);
        console.log(`  Evidence URL: ${field2}`);
      } else {
        console.log(`  Token: ${field1} (${field2})`);
      }
      console.log(`  Title: ${title}`);
      console.log(`  Sides: "${sideAName}" vs "${sideBName}"`);
      console.log(`  Bridge: ${bridgeSender} → EID ${targetChainEid} → ${targetContract}`);

      const code = this.loadOracleCode(resolutionType);

      // Deploy to GenLayer
      const hash = await this.genLayerClient.deployContract({
        code,
        args,
        leaderOnly: false,
      });

      console.log(`[EVM→GL] Deploy TX: ${hash}`);

      // Record tx hash immediately so AIConsole can start polling
      // even before the oracle is fully deployed
      await recordOracle(betContract, hash, "");

      // Wait for deployment — GenLayer validators can take 2-5 min
      let receipt: any = null;
      try {
        receipt = await this.genLayerClient.waitForTransactionReceipt({
          hash,
          status: "ACCEPTED",
          retries: 60,
          interval: 3000,
        });
      } catch (waitErr: any) {
        // Fetch final tx status for diagnosis
        let finalStatus = "unknown";
        try {
          const tx = await this.genLayerClient.getTransactionByHash({ hash });
          finalStatus = tx?.status ?? "unknown";
          console.error(`[EVM→GL] TX final status: ${finalStatus}`);
          if (finalStatus === "LEADER_ERROR" || finalStatus === "UNDETERMINED") {
            console.error(`[EVM→GL] GenLayer consensus failed — oracle will retry on next resolve() call`);
          }
        } catch {}
        throw waitErr;
      }

      const oracleAddress = receipt?.data?.contract_address;
      console.log(`[EVM→GL] Oracle deployed: ${oracleAddress}`);

      // Update registry with the resolved oracle address
      if (oracleAddress) {
        await recordOracle(betContract, hash, oracleAddress);
      }

      return oracleAddress ?? null;
    } catch (error) {
      console.error("[EVM→GL] Deploy error:", error);
      return null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();

      // On first run, look back LOOKBACK_BLOCKS to catch recent missed events
      const LOOKBACK_BLOCKS = 500; // ~16 min on Base Sepolia (2s blocks)
      if (this.lastBlock === 0) {
        this.lastBlock = Math.max(0, currentBlock - LOOKBACK_BLOCKS);
        console.log(`[EVM→GL] Starting from block ${this.lastBlock} (lookback ${LOOKBACK_BLOCKS} blocks)`);
      }

      // No new blocks
      if (currentBlock <= this.lastBlock) {
        return;
      }

      // Query for new events
      const filter = this.factoryContract.filters.ResolutionRequested();
      const events = await this.factoryContract.queryFilter(
        filter,
        this.lastBlock + 1,
        currentBlock
      );

      for (const event of events) {
        const eventId = `${event.transactionHash}-${event.index}`;

        if (this.processedEvents.has(eventId)) {
          continue;
        }

        const log = event as ethers.EventLog;
        const [betContract, creator, resolutionType, title, sideAName, sideBName, resolutionData, eventTimestamp] = log.args;

        // Mark as processed BEFORE deploying (deployment is slow)
        this.processedEvents.add(eventId);

        const decoded = decodeResolutionData(resolutionData);
        console.log(`\n[EVM→GL] *** ResolutionRequested ***`);
        console.log(`  Bet: ${betContract}`);
        console.log(`  Creator: ${creator}`);
        console.log(`  Type: ${RESOLUTION_TYPES[Number(resolutionType)]} (${resolutionType})`);
        console.log(`  Title: ${title}`);
        console.log(`  Sides: "${sideAName}" vs "${sideBName}"`);
        console.log(`  Data: ${decoded ? `[${decoded.join(", ")}]` : "(empty)"}`);
        console.log(`  TX: ${event.transactionHash}`);

        // Deploy oracle to GenLayer
        await this.deployOracle(
          betContract as string,
          Number(resolutionType),
          title as string,
          sideAName as string,
          sideBName as string,
          resolutionData as string
        );
      }

      this.lastBlock = currentBlock;
    } catch (error) {
      console.error("[EVM→GL] Poll error:", error);
    }
  }

  public startListening(): void {
    console.log(`[EVM→GL] Starting event polling (every 5s)...`);
    console.log(`[EVM→GL] Factory: ${getBetFactoryAddress()}`);
    console.log(`[EVM→GL] RPC: ${getBaseSepoliaRpcUrl()}`);
    console.log(`[EVM→GL] GenLayer: ${getGenlayerRpcUrl()}`);

    this.poll();

    // Poll every 5 seconds
    this.pollInterval = setInterval(() => this.poll(), 5000);

    console.log(`[EVM→GL] Polling for ResolutionRequested events\n`);
  }

  public stopListening(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log(`[EVM→GL] Stopped polling`);
  }
}
