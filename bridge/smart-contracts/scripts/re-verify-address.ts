import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const ABI = ["function setBridgeAddress(uint32 _eid, bytes32 _bridgeAddress) external"];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
  
  // REAL CORRECT ADDRESS (from 0x19E88...C4)
  const forwarderAddress = "0x19E88E3790A433721faD03CD5A68A100E18F40c4E"; // Wait! Let me re-verify length.
  // 19 E8 8E 37 90 A4 33 72 1f aD 03 CD 5A 68 A1 00 E1 8F 40 c4 E (41 characters?!)
  // I'll check the terminal output from the REAL deployment.
}
