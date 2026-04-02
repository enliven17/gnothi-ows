import { ethers } from "hardhat";

/**
 * Deploy a GroupMarket (shared treasury) for a specific prediction market.
 *
 * Required env:
 *   FACTORY_ADDRESS         — BetFactoryCOFI address
 *   MOCK_USDL_ADDRESS       — USDC token address (Base Sepolia)
 *   TARGET_MARKET           — BetCOFI market to bet on
 *   BET_SIDE_A              — "true" or "false"
 *   CONFIDENCE              — 1-99
 *   FUNDING_GOAL_USDC       — e.g. "100" (= 100 USDC = 100_000_000 wei)
 *   GROUP_NAME              — display name
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying GroupMarket from:", deployer.address);

  const usdcAddress   = process.env.MOCK_USDL_ADDRESS!;
  const factoryAddr   = process.env.FACTORY_ADDRESS!;
  const targetMarket  = process.env.TARGET_MARKET!;
  const betOnSideA    = process.env.BET_SIDE_A === "true";
  const confidence    = parseInt(process.env.CONFIDENCE ?? "60");
  const goalUsdc      = process.env.FUNDING_GOAL_USDC ?? "100";
  const groupName     = process.env.GROUP_NAME ?? "Gnothi Group";

  if (!usdcAddress || !factoryAddr || !targetMarket) {
    throw new Error("Missing required env vars: MOCK_USDL_ADDRESS, FACTORY_ADDRESS, TARGET_MARKET");
  }

  const fundingGoal = ethers.parseUnits(goalUsdc, 6); // USDC has 6 decimals

  const GroupMarket = await ethers.getContractFactory("GroupMarket");
  const gm = await GroupMarket.deploy(
    usdcAddress,
    factoryAddr,
    targetMarket,
    betOnSideA,
    confidence,
    fundingGoal,
    groupName
  );

  await gm.waitForDeployment();
  const address = await gm.getAddress();

  console.log(`\n✅ GroupMarket deployed to: ${address}`);
  console.log(`   Group: ${groupName}`);
  console.log(`   Target: ${targetMarket}`);
  console.log(`   Side: ${betOnSideA ? "A" : "B"} @ ${confidence}% confidence`);
  console.log(`   Funding goal: ${goalUsdc} USDC`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
