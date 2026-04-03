/**
 * Sets the bridge address (BridgeReceiver on Base Sepolia) on the BridgeForwarder.
 *
 * Run on zkSync Sepolia:
 *   npx hardhat run scripts/set-bridge-address.ts --network zkSyncSepoliaTestnet
 *
 * Required .env vars:
 *   BRIDGE_FORWARDER_ADDRESS, DST_EID, DST_BRIDGE_ADDRESS, PRIVATE_KEY, ZKSYNC_SEPOLIA_RPC_URL
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const BRIDGE_FORWARDER_ABI = [
  "function setBridgeAddress(uint32 _eid, bytes32 _bridgeAddress) external",
  "function bridgeAddresses(uint32) external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function OWNER_ROLE() external view returns (bytes32)",
  "function isHashUsed(bytes32 _txHash) external view returns (bool)",
];

async function main() {
  const forwarderAddress = process.env.BRIDGE_FORWARDER_ADDRESS;
  const dstEidStr = process.env.DST_EID;
  const dstBridgeAddress = process.env.DST_BRIDGE_ADDRESS;

  if (!forwarderAddress || !dstEidStr || !dstBridgeAddress) {
    throw new Error(
      "Missing required env vars: BRIDGE_FORWARDER_ADDRESS, DST_EID, DST_BRIDGE_ADDRESS"
    );
  }

  const dstEid = parseInt(dstEidStr);
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);

  const forwarder = new ethers.Contract(
    forwarderAddress,
    BRIDGE_FORWARDER_ABI,
    signer
  );

  // Check current state
  const currentBridge = await forwarder.bridgeAddresses(dstEid);
  console.log(`\nCurrent bridgeAddresses[${dstEid}]:`, currentBridge);

  if (currentBridge !== ethers.ZeroHash) {
    console.log("✓ Bridge address already set. No action needed.");
    return;
  }

  // Check signer has OWNER_ROLE
  const ownerRole = await forwarder.OWNER_ROLE();
  const hasRole = await forwarder.hasRole(ownerRole, signer.address);
  console.log(`Signer has OWNER_ROLE: ${hasRole}`);
  if (!hasRole) {
    throw new Error(
      `Signer ${signer.address} does not have OWNER_ROLE on ${forwarderAddress}. Cannot call setBridgeAddress.`
    );
  }

  // Convert address to bytes32
  const bridgeBytes32 = ethers.zeroPadValue(
    ethers.getAddress(dstBridgeAddress),
    32
  );

  console.log(`\nCalling setBridgeAddress:`);
  console.log(`  Forwarder: ${forwarderAddress}`);
  console.log(`  DST EID:   ${dstEid}`);
  console.log(`  Receiver:  ${dstBridgeAddress}`);
  console.log(`  bytes32:   ${bridgeBytes32}`);

  const tx = await forwarder.setBridgeAddress(dstEid, bridgeBytes32);
  console.log(`\nTX hash: ${tx.hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(`✓ Confirmed in block ${receipt.blockNumber}`);

  // Verify
  const newBridge = await forwarder.bridgeAddresses(dstEid);
  console.log(`\nNew bridgeAddresses[${dstEid}]: ${newBridge}`);
  console.log("✓ Bridge address set successfully!");
}

main().catch((err) => {
  console.error("\n❌ Script failed:");
  console.error(err);
  process.exitCode = 1;
});
