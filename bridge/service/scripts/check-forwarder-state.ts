/**
 * Check BridgeForwarder state on zkSync Sepolia
 * Run: node --loader ts-node/esm scripts/check-forwarder-state.ts
 */

import { ethers } from "ethers";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

const BRIDGE_FORWARDER_ABI = [
  "function setBridgeAddress(uint32 _eid, bytes32 _bridgeAddress) external",
  "function bridgeAddresses(uint32) external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function OWNER_ROLE() external view returns (bytes32)",
  "function isHashUsed(bytes32) external view returns (bool)",
];

const FORWARDER_ADDRESS = process.env.BRIDGE_FORWARDER_ADDRESS!;
const RPC = process.env.FORWARDER_NETWORK_RPC_URL!;
const WALLET = process.env.PRIVATE_KEY!;

async function main() {
  if (!FORWARDER_ADDRESS) {
    throw new Error("Missing BRIDGE_FORWARDER_ADDRESS in .env");
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(WALLET, provider);

  console.log("RPC      :", RPC);
  console.log("Forwarder:", FORWARDER_ADDRESS);
  console.log("Signer   :", signer.address);

  // 1. Check if contract exists
  const code = await provider.getCode(FORWARDER_ADDRESS);
  console.log("\nContract code:", code === "0x" ? "❌ EMPTY (not deployed!)" : `✓ exists (${code.length / 2 - 1} bytes)`);

  if (code === "0x") {
    console.log("\n⚠️  No contract at this address on zkSync Sepolia.");
    console.log("   You need to re-deploy BridgeForwarder.");
    return;
  }

  // 2. Check peer for EID 40245
  const forwarder = new ethers.Contract(FORWARDER_ADDRESS, BRIDGE_FORWARDER_ABI, signer);

  try {
    const bridge40245 = await forwarder.bridgeAddresses(40245);
    console.log("\nbridgeAddresses[40245]:", bridge40245);
    if (bridge40245 === ethers.ZeroHash) {
      console.log("❌ Bridge address NOT SET for EID 40245");
    } else {
      console.log("✓ Bridge address is set");
    }
  } catch (e: any) {
    console.log("bridgeAddresses[40245]: ERROR -", e.message);
  }

  // 3. Check OWNER_ROLE
  try {
    const ownerRole = await forwarder.OWNER_ROLE();
    const hasRole = await forwarder.hasRole(ownerRole, signer.address);
    console.log(`\nSigner has OWNER_ROLE: ${hasRole ? "✓ YES" : "❌ NO"}`);
  } catch (e: any) {
    console.log("OWNER_ROLE check ERROR:", e.message);
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
