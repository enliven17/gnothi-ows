/**
 * Standalone script to call setBridgeAddress on the BridgeForwarder.
 * Run from bridge/service directory:
 *   node --loader ts-node/esm scripts/set-bridge-address.ts
 */

import { ethers } from "ethers";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from bridge/service/.env
dotenv.config({ path: join(__dirname, "..", ".env") });

const BRIDGE_FORWARDER_ABI = [
  "function setBridgeAddress(uint32 _eid, bytes32 _bridgeAddress) external",
  "function bridgeAddresses(uint32) external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function OWNER_ROLE() external view returns (bytes32)",
];

// ─── Config ───────────────────────────────────────────────────────────────────
const FORWARDER_ADDRESS = process.env.BRIDGE_FORWARDER_ADDRESS!;
const FORWARDER_RPC     = process.env.FORWARDER_NETWORK_RPC_URL!;  // zkSync Sepolia
const PRIVATE_KEY       = process.env.PRIVATE_KEY!;
const DST_EID           = 40245;                                    // Base Sepolia
const DST_BRIDGE        = "0xD3a967F16261C226Ed13ab8320ECB396cD7da0E5"; // BridgeReceiver
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!FORWARDER_ADDRESS || !FORWARDER_RPC || !PRIVATE_KEY) {
    throw new Error("Missing BRIDGE_FORWARDER_ADDRESS, FORWARDER_NETWORK_RPC_URL, or PRIVATE_KEY in .env");
  }

  const provider = new ethers.JsonRpcProvider(FORWARDER_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const forwarder = new ethers.Contract(FORWARDER_ADDRESS, BRIDGE_FORWARDER_ABI, wallet);

  console.log("=== Set Bridge Address ===");
  console.log("Forwarder :", FORWARDER_ADDRESS);
  console.log("Signer    :", wallet.address);
  console.log("RPC       :", FORWARDER_RPC);

  // 1. Check current state
  const current = await forwarder.bridgeAddresses(DST_EID);
  console.log(`\nCurrent bridgeAddresses[${DST_EID}]:`, current);
  if (current !== ethers.ZeroHash) {
    console.log("✓ Bridge address already set. No action needed.");
    process.exit(0);
  }

  // 2. Check OWNER_ROLE
  const ownerRole = await forwarder.OWNER_ROLE();
  const hasRole   = await forwarder.hasRole(ownerRole, wallet.address);
  console.log(`Has OWNER_ROLE: ${hasRole}`);
  if (!hasRole) {
    throw new Error(`Signer ${wallet.address} does NOT have OWNER_ROLE. Cannot proceed.`);
  }

  // 3. Prepare bytes32 value
  const bridgeBytes32 = ethers.zeroPadValue(ethers.getAddress(DST_BRIDGE), 32);
  console.log(`\nSetting bridge address for EID ${DST_EID}:`);
  console.log("  DST_BRIDGE :", DST_BRIDGE);
  console.log("  bytes32    :", bridgeBytes32);

  // 4. Send transaction
  const tx = await forwarder.setBridgeAddress(DST_EID, bridgeBytes32);
  console.log("\nTX hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✓ Confirmed in block", receipt.blockNumber);

  // 5. Verify
  const updated = await forwarder.bridgeAddresses(DST_EID);
  console.log(`\nUpdated bridgeAddresses[${DST_EID}]:`, updated);
  console.log("✓ Done! Bridge address successfully set.");
}

main().catch((err) => {
  console.error("\n❌ Failed:", err.message || err);
  process.exit(1);
});
