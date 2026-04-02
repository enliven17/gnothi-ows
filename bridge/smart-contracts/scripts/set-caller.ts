/**
 * Grant CALLER_ROLE to the relay wallet on BridgeForwarder.
 *
 * Run with the OWNER wallet's private key.
 *
 * Usage:
 *   OWNER_PRIVATE_KEY=0x... NEW_CALLER=0x... npx hardhat run scripts/set-caller.ts --network zkSyncSepoliaTestnet
 *
 * Or if owner == relay wallet:
 *   npx hardhat run scripts/set-caller.ts --network zkSyncSepoliaTestnet
 *
 * Required env:
 *   BRIDGE_FORWARDER_ADDRESS  - BridgeForwarder contract on zkSync Sepolia
 *   OWNER_PRIVATE_KEY         - Private key of the OWNER_ROLE wallet (or PRIVATE_KEY if same)
 *   NEW_CALLER                - Wallet to grant CALLER_ROLE (defaults to PRIVATE_KEY derived address)
 */

import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const BRIDGE_FORWARDER_ABI = [
  "function updateCaller(address _newCaller) external",
  "function CALLER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function getRoleMember(bytes32 role, uint256 index) view returns (address)",
  "function getRoleMemberCount(bytes32 role) view returns (uint256)",
];

async function main() {
  const forwarderAddress = process.env.BRIDGE_FORWARDER_ADDRESS;
  if (!forwarderAddress) throw new Error("Missing BRIDGE_FORWARDER_ADDRESS");

  // Owner: use OWNER_PRIVATE_KEY if set, otherwise fall back to PRIVATE_KEY
  const ownerKey = process.env.OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!ownerKey) throw new Error("Missing OWNER_PRIVATE_KEY or PRIVATE_KEY");

  // New caller: use NEW_CALLER env or derive from PRIVATE_KEY
  let newCaller = process.env.NEW_CALLER;
  if (!newCaller) {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error("Missing NEW_CALLER and PRIVATE_KEY");
    newCaller = new ethers.Wallet(pk).address;
  }

  const provider = new ethers.JsonRpcProvider(process.env.FORWARDER_NETWORK_RPC_URL);
  const ownerWallet = new ethers.Wallet(ownerKey, provider);

  console.log("BridgeForwarder:", forwarderAddress);
  console.log("Owner wallet:   ", ownerWallet.address);
  console.log("New caller:     ", newCaller);

  const forwarder = new ethers.Contract(forwarderAddress, BRIDGE_FORWARDER_ABI, ownerWallet);

  // Show current caller
  const callerRole = await forwarder.CALLER_ROLE();
  const callerCount = await forwarder.getRoleMemberCount(callerRole);
  if (Number(callerCount) > 0) {
    const currentCaller = await forwarder.getRoleMember(callerRole, 0);
    console.log("Current caller: ", currentCaller);
    if (currentCaller.toLowerCase() === newCaller.toLowerCase()) {
      console.log("✓ Already correct caller. Nothing to do.");
      return;
    }
  }

  // Check owner has CALLER_ROLE admin (OWNER_ROLE)
  const ownerRole = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
  const hasOwner = await forwarder.hasRole(ownerRole, ownerWallet.address);
  if (!hasOwner) {
    throw new Error(`Wallet ${ownerWallet.address} does not have OWNER_ROLE on BridgeForwarder`);
  }

  console.log("\nCalling updateCaller...");
  const tx = await forwarder.updateCaller(newCaller);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ CALLER_ROLE granted to", newCaller);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
