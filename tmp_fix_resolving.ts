
import { ethers, AbiCoder } from "ethers";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), "bridge/service/.env") });

const FACTORY_ADDRESS = "0x475ef84215B543AeD5335542E2b7ce67a29e549b";
const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const GENLAYER_RPC = "https://studio.genlayer.com/api";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BRIDGE_SENDER = "0x8bFa57161068697eC1d7121e6d498cacA4de59E2"; // From .env
const BASE_SEPOLIA_LZ_EID = 40245;

const FACTORY_ABI = [
  "function getResolvingBets() external view returns (address[] memory)",
];

const BET_ABI = [
  "function status() view returns (uint8)",
  "function title() view returns (string)",
  "function sideAName() view returns (string)",
  "function sideBName() view returns (string)",
  "function resolutionData() view returns (bytes)",
  "function resolutionType() view returns (uint8)",
];

const ORACLE_CONTRACTS = {
  0: "crypto_prediction_market.py",
  1: "stock_prediction_market.py",
  2: "news_pm.py",
};

async function main() {
  if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

  const account = createAccount(`0x${PRIVATE_KEY.replace(/^0x/, "")}`);
  const genLayerClient = createClient({
    chain: {
      ...studionet,
      rpcUrls: { default: { http: [GENLAYER_RPC] } }
    },
    account,
  });

  console.log("Fetching resolving bets...");
  const resolvingBets = await factory.getResolvingBets();
  console.log(`Found ${resolvingBets.length} resolving bets in factory.`);

  for (const addr of resolvingBets) {
    console.log(`\nProcessing: ${addr}`);
    const bet = new ethers.Contract(addr, BET_ABI, provider);
    
    try {
      const [status, title, sideA, sideB, resData, resType] = await Promise.all([
        bet.status(),
        bet.title(),
        bet.sideAName(),
        bet.sideBName(),
        bet.resolutionData(),
        bet.resolutionType(),
      ]);

      console.log(`  Market: ${title}`);
      console.log(`  Status: ${status}`);

      if (Number(status) !== 1) { // 1 = RESOLVING
        console.log("  Not RESOLVING, skipping.");
        continue;
      }

      // Re-deploy oracle logic
      const abiCoder = AbiCoder.defaultAbiCoder();
      let field1, field2;
      try {
        [field1, field2] = abiCoder.decode(["string", "string"], resData);
      } catch (e) {
        console.error(`  Failed to decode resolution data for ${addr}`);
        continue;
      }

      const oracleFile = ORACLE_CONTRACTS[Number(resType)];
      const oraclesPath = path.join(process.cwd(), "bridge/service/intelligent-oracles");
      const code = readFileSync(path.join(oraclesPath, oracleFile), "utf-8");

      const args = [
        addr, field1, field2, title, sideA, sideB,
        BRIDGE_SENDER, BASE_SEPOLIA_LZ_EID, FACTORY_ADDRESS
      ];

      console.log(`  Deploying oracle to GenLayer...`);
      const hash = await genLayerClient.deployContract({ code, args, leaderOnly: false });
      console.log(`  Oracle TX: ${hash}`);

      // Wait for it
      const receipt = await genLayerClient.waitForTransactionReceipt({
        hash, status: "ACCEPTED", retries: 30, interval: 3000,
      });
      console.log(`  Oracle deployed: ${receipt?.data?.contract_address}`);

    } catch (e) {
      console.error(`  Error processing ${addr}:`, e.message);
    }
  }
}

main();
