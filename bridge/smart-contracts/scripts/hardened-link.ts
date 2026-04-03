import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const ABI = ["function setBridgeAddress(uint32 _eid, bytes32 _bridgeAddress) external"];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
  
  const forwarderAddress = "0x19E88E3790A433721faD03CD5A68A100E18F40c4E";
  const dstEid = 40245;
  const dstBridge = "0xD3a967F16261C226Ed13ab8320ECB396cD7da0E5";
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);

  console.log(`Linking forwarder ${forwarderAddress} to receiver ${dstBridge}...`);
  const contract = new ethers.Contract(forwarderAddress, ABI, wallet);
  
  const tx = await contract.setBridgeAddress(dstEid, dstBridgeBytes32);
  console.log("Transaction Hash:", tx.hash);
  await tx.wait();
  console.log("✓ Success! Bridge link verified.");
}

main().catch(console.error);
