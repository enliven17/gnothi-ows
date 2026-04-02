/**
 * E2E Test: NEWS Resolution Flow
 *
 * Tests the full NEWS market lifecycle:
 * 1. Create NEWS market on Base Sepolia via createNewsBet()
 * 2. Place bets on both sides with probabilities
 * 3. Request resolution after end date
 * 4. Service deploys news_pm.py to GenLayer
 * 5. Oracle fetches evidence URL and sends a bridge message back
 * 6. Service relays to EVM and the market leaves RESOLVING state
 *
 * Prerequisites:
 * - Bridge service must be running (npm run dev in bridge/service)
 * - BridgeReceiver configured on factory
 * - Signer must be factory owner or approved creator
 * - Signer must have Base Sepolia ETH and MockUSDL
 *
 * Usage:
 *   npx tsx scripts/test-news-e2e-flow.ts
 *
 * Optional env vars:
 *   NEWS_TITLE
 *   NEWS_QUESTION
 *   NEWS_EVIDENCE_URL
 *   SIDE_A_NAME
 *   SIDE_B_NAME
 */

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const BET_AMOUNT_A = 10_000n; // 0.01 USDL
const BET_AMOUNT_B = 20_000n; // 0.02 USDL
const BET_PROBABILITY_A = 67;
const BET_PROBABILITY_B = 54;

const BET_FACTORY_ABI = [
  "function createNewsBet(string title, string question, string evidenceUrl, string sideAName, string sideBName, uint256 endDate) external returns (address)",
  "function placeBet(address betAddress, bool onSideA, uint256 amount, uint8 probability) external",
  "function owner() view returns (address)",
  "function approvedCreators(address) view returns (bool)",
  "event BetCreated(address indexed betAddress, address indexed creator, string title, uint256 endDate)",
];

const BET_COFI_ABI = [
  "function resolve() external",
  "function status() view returns (uint8)",
  "function isResolved() view returns (bool)",
  "function resolutionType() view returns (uint8)",
  "function resolutionData() view returns (bytes)",
  "function totalSideA() view returns (uint256)",
  "function totalSideB() view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const STATUS_NAMES = ["ACTIVE", "RESOLVING", "RESOLVED", "UNDETERMINED"];

function getConfig() {
  const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
  const betFactoryAddress = process.env.BET_FACTORY_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY;
  const mockUsdlAddress = process.env.MOCK_USDL_ADDRESS;

  if (!baseSepoliaRpcUrl || !betFactoryAddress || !privateKey || !mockUsdlAddress) {
    throw new Error("Missing required env vars: BASE_SEPOLIA_RPC_URL, BET_FACTORY_ADDRESS, PRIVATE_KEY, MOCK_USDL_ADDRESS");
  }

  return { baseSepoliaRpcUrl, betFactoryAddress, privateKey, mockUsdlAddress };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const config = getConfig();

  console.log("\n========================================");
  console.log("  E2E Test: NEWS Resolution Flow");
  console.log("========================================");
  console.log(`Factory: ${config.betFactoryAddress}`);
  console.log(`RPC: ${config.baseSepoliaRpcUrl}`);

  const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  console.log(`\nAccount: ${wallet.address}`);

  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
  if (ethBalance < ethers.parseEther("0.001")) {
    throw new Error("Insufficient ETH balance for transactions");
  }

  const factory = new ethers.Contract(config.betFactoryAddress, BET_FACTORY_ABI, wallet);
  const token = new ethers.Contract(config.mockUsdlAddress, ERC20_ABI, wallet);

  const owner = await factory.owner();
  const isApproved = await factory.approvedCreators(wallet.address);
  console.log(`Factory Owner: ${owner}`);
  console.log(`Is Approved Creator: ${isApproved || wallet.address.toLowerCase() === owner.toLowerCase()}`);

  const now = Math.floor(Date.now() / 1000);
  const endDate = now + 30;
  const market = {
    title: process.env.NEWS_TITLE || "Did the referenced event happen according to the source?",
    question: process.env.NEWS_QUESTION || "Did the event described in the source article occur?",
    evidenceUrl: process.env.NEWS_EVIDENCE_URL || "https://www.reuters.com/",
    sideAName: process.env.SIDE_A_NAME || "Yes, happened",
    sideBName: process.env.SIDE_B_NAME || "No, did not happen",
    endDate,
  };

  console.log("\n--- Step 1: Creating NEWS Market ---");
  console.log(`  Title: ${market.title}`);
  console.log(`  Question: ${market.question}`);
  console.log(`  Evidence URL: ${market.evidenceUrl}`);
  console.log(`  Side A: ${market.sideAName}`);
  console.log(`  Side B: ${market.sideBName}`);
  console.log(`  End Date: ${new Date(market.endDate * 1000).toISOString()}`);

  const createTx = await factory.createNewsBet(
    market.title,
    market.question,
    market.evidenceUrl,
    market.sideAName,
    market.sideBName,
    market.endDate
  );
  console.log(`  TX: ${createTx.hash}`);
  const createReceipt = await createTx.wait();

  let betAddress = "";
  for (const log of createReceipt.logs) {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "BetCreated") {
        betAddress = parsed.args[0];
        break;
      }
    } catch {
      // ignore unrelated logs
    }
  }

  if (!betAddress) {
    throw new Error("Failed to extract bet address from BetCreated event");
  }
  console.log(`  Bet Created: ${betAddress}`);

  const bet = new ethers.Contract(betAddress, BET_COFI_ABI, wallet);
  const resolutionType = await bet.resolutionType();
  if (Number(resolutionType) !== 2) {
    throw new Error(`Expected NEWS resolutionType=2, got ${resolutionType}`);
  }

  console.log("\n--- Step 2: Funding and Placing Bets ---");
  const tokenBalance = await token.balanceOf(wallet.address);
  const requiredToken = BET_AMOUNT_A + BET_AMOUNT_B;
  console.log(`  USDL Balance: ${tokenBalance} (${Number(tokenBalance) / 1e6} USDL)`);

  if (tokenBalance < requiredToken) {
    throw new Error(`Insufficient USDL: have ${Number(tokenBalance) / 1e6}, need ${Number(requiredToken) / 1e6}`);
  }

  const allowance = await token.allowance(wallet.address, config.betFactoryAddress);
  if (allowance < requiredToken) {
    console.log("  Approving USDL to factory...");
    const approveTx = await token.approve(config.betFactoryAddress, ethers.MaxUint256);
    await approveTx.wait();
    console.log("  Approved!");
  }

  const betATx = await factory.placeBet(betAddress, true, BET_AMOUNT_A, BET_PROBABILITY_A);
  await betATx.wait();
  console.log(`  Side A bet TX: ${betATx.hash}`);

  const betBTx = await factory.placeBet(betAddress, false, BET_AMOUNT_B, BET_PROBABILITY_B);
  await betBTx.wait();
  console.log(`  Side B bet TX: ${betBTx.hash}`);

  const totalA = await bet.totalSideA();
  const totalB = await bet.totalSideB();
  console.log(`  Total Side A: ${Number(totalA) / 1e6} USDL`);
  console.log(`  Total Side B: ${Number(totalB) / 1e6} USDL`);

  console.log("\n--- Step 3: Waiting for End Date and Resolving ---");
  const waitTime = market.endDate - Math.floor(Date.now() / 1000) + 2;
  if (waitTime > 0) {
    console.log(`  Waiting ${waitTime}s for market end...`);
    await sleep(waitTime * 1000);
  }

  const statusBefore = await bet.status();
  console.log(`  Current Status: ${STATUS_NAMES[Number(statusBefore)]}`);
  if (statusBefore !== 0n) {
    throw new Error(`Expected ACTIVE before resolve, got ${STATUS_NAMES[Number(statusBefore)]}`);
  }

  const resolveTx = await bet.resolve();
  console.log(`  Resolve TX: ${resolveTx.hash}`);
  await resolveTx.wait();

  const statusAfterResolve = await bet.status();
  console.log(`  Status after resolve(): ${STATUS_NAMES[Number(statusAfterResolve)]}`);
  if (statusAfterResolve !== 1n) {
    throw new Error(`Expected RESOLVING after resolve(), got ${STATUS_NAMES[Number(statusAfterResolve)]}`);
  }

  console.log("\n--- Step 4: Waiting for Bridge/Oracle Result ---");
  console.log("  The bridge service should now deploy news_pm.py and relay the result back.");
  console.log("  Polling status every 10 seconds...\n");

  const timeoutMs = 5 * 60 * 1000;
  const pollIntervalMs = 10 * 1000;
  const startTime = Date.now();

  let finalStatus = 1n;
  while (Date.now() - startTime < timeoutMs) {
    await sleep(pollIntervalMs);
    const currentStatus = await bet.status();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  [${elapsed}s] Status: ${STATUS_NAMES[Number(currentStatus)]}`);

    if (currentStatus !== 1n) {
      finalStatus = currentStatus;
      break;
    }
  }

  console.log("\n--- Step 5: Verifying Result ---");
  if (finalStatus === 1n) {
    console.log("  TIMEOUT: Market is still RESOLVING after 5 minutes");
    console.log("  Check bridge service logs and GenLayer deployment status.");
    process.exit(1);
  }

  console.log(`  Final Status: ${STATUS_NAMES[Number(finalStatus)]}`);
  if (finalStatus !== 2n && finalStatus !== 3n) {
    throw new Error(`Unexpected final status: ${finalStatus}`);
  }

  const isResolved = await bet.isResolved();
  if (!isResolved) {
    throw new Error("Bet left RESOLVING but isResolved() is still false");
  }

  console.log("\n========================================");
  console.log("  NEWS E2E Test PASSED");
  console.log("========================================\n");
  console.log(`Bet Address: ${betAddress}`);
  console.log(`Final Status: ${STATUS_NAMES[Number(finalStatus)]}`);
  console.log(`Elapsed: ${Math.round((Date.now() - startTime) / 1000)}s`);
}

main().catch((error) => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
