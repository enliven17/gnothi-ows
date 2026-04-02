import { ethers } from "hardhat";
import { AbiCoder } from "ethers";

const RESOLUTION_TYPES = ["CRYPTO", "STOCKS", "NEWS"];

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function decodeResolutionData(data: string): string {
  if (!data || data === "0x") return "(empty)";
  try {
    const abiCoder = AbiCoder.defaultAbiCoder();
    const [param1, param2] = abiCoder.decode(["string", "string"], data);
    return `[${param1}, ${param2}]`;
  } catch {
    return "(could not decode)";
  }
}

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS;

  if (!factoryAddress) {
    console.log("Usage: FACTORY_ADDRESS=0x... npx hardhat run scripts/testing/monitor-events.ts --network baseSepolia");
    throw new Error("Missing required env var: FACTORY_ADDRESS");
  }

  const factory = await ethers.getContractAt("BetFactoryCOFI", factoryAddress);
  const eventSource = factory as any;

  console.log(`\n========================================`);
  console.log(`  Factory Event Monitor`);
  console.log(`========================================`);
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Started: ${timestamp()}`);
  console.log(`\nListening for events... (Ctrl+C to stop)\n`);

  // BetCreated
  eventSource.on("BetCreated", (betAddress: string, creator: string, title: string, endDate: bigint) => {
    console.log(`[${timestamp()}] BetCreated`);
    console.log(`  Bet: ${betAddress}`);
    console.log(`  Creator: ${creator}`);
    console.log(`  Title: ${title}`);
    console.log(`  End Date: ${new Date(Number(endDate) * 1000).toISOString()}`);
    console.log();
  });

  // BetPlaced
  eventSource.on("BetPlaced", (betAddress: string, bettor: string, onSideA: boolean, amount: bigint) => {
    console.log(`[${timestamp()}] BetPlaced`);
    console.log(`  Bet: ${betAddress}`);
    console.log(`  Bettor: ${bettor}`);
    console.log(`  Side: ${onSideA ? "A" : "B"}`);
    console.log(`  Amount: ${amount} (${Number(amount) / 1e6} USDC)`);
    console.log();
  });

  // ResolutionRequested - THE MAIN ONE (expanded format)
  eventSource.on("ResolutionRequested", (
    betContract: string,
    creator: string,
    resolutionType: bigint,
    title: string,
    sideAName: string,
    sideBName: string,
    resolutionData: string,
    eventTimestamp: bigint
  ) => {
    console.log(`[${timestamp()}] *** ResolutionRequested ***`);
    console.log(`  Bet: ${betContract}`);
    console.log(`  Creator: ${creator}`);
    console.log(`  Resolution Type: ${RESOLUTION_TYPES[Number(resolutionType)]} (${resolutionType})`);
    console.log(`  Title: ${title}`);
    console.log(`  Side A: ${sideAName}`);
    console.log(`  Side B: ${sideBName}`);
    console.log(`  Resolution Data: ${decodeResolutionData(resolutionData)}`);
    console.log(`  Timestamp: ${new Date(Number(eventTimestamp) * 1000).toISOString()}`);
    console.log();
  });

  // BetStatusChanged
  eventSource.on("BetStatusChanged", (betContract: string, oldStatus: bigint, newStatus: bigint) => {
    const STATUS_NAMES = ["ACTIVE", "RESOLVING", "RESOLVED", "UNDETERMINED"];
    console.log(`[${timestamp()}] BetStatusChanged`);
    console.log(`  Bet: ${betContract}`);
    console.log(`  Old Status: ${STATUS_NAMES[Number(oldStatus)]}`);
    console.log(`  New Status: ${STATUS_NAMES[Number(newStatus)]}`);
    console.log();
  });

  // OracleResolutionReceived
  eventSource.on("OracleResolutionReceived", (betContract: string, sourceChainId: bigint) => {
    console.log(`[${timestamp()}] OracleResolutionReceived`);
    console.log(`  Bet: ${betContract}`);
    console.log(`  Source Chain ID: ${sourceChainId}`);
    console.log();
  });

  // BridgeReceiverUpdated
  eventSource.on("BridgeReceiverUpdated", (oldReceiver: string, newReceiver: string) => {
    console.log(`[${timestamp()}] BridgeReceiverUpdated`);
    console.log(`  Old: ${oldReceiver}`);
    console.log(`  New: ${newReceiver}`);
    console.log();
  });

  // CreatorApprovalUpdated
  eventSource.on("CreatorApprovalUpdated", (creator: string, approved: boolean) => {
    console.log(`[${timestamp()}] CreatorApprovalUpdated`);
    console.log(`  Creator: ${creator}`);
    console.log(`  Approved: ${approved}`);
    console.log();
  });

  // ResolverApprovalUpdated
  eventSource.on("ResolverApprovalUpdated", (resolver: string, approved: boolean) => {
    console.log(`[${timestamp()}] ResolverApprovalUpdated`);
    console.log(`  Resolver: ${resolver}`);
    console.log(`  Approved: ${approved}`);
    console.log();
  });

  // Keep script running
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
