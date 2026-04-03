import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const ABI = [
  "function setBridgeAddress(uint32 _eid, bytes32 _bridgeAddress) external",
  "function getRoleAdmin(bytes32 role) public view returns (bytes32)",
  "function grantRole(bytes32 role, address account) public",
  "function OWNER_ROLE() public view returns (bytes32)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  // Use the ORIGINAL address as it definitely exists
  const bridge = "0x70ca1e3b7451d1560d64a4675158f864996099ae"; 
  const dstBridge = "0xd3a967f16261c226ed13ab8320ecb396cd7da0e5";
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);
  const dstEid = 40245;

  console.log(`Setting bridge on: ${bridge}`);
  const contract = new ethers.Contract(bridge, ABI, wallet);
  
  try {
     const tx = await contract.setBridgeAddress(dstEid, dstBridgeBytes32);
     console.log("Transaction Hash:", tx.hash);
     await tx.wait();
     console.log("✓ SUCCESS: Bridge linked on original contract.");
  } catch (err: any) {
     console.error("Link failed:", err.message);
  }
}

main().catch(console.error);
