import { ethers } from "ethers";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  // Re-read existing artifact from YOUR artifacts folder
  const artifactPath = path.resolve("artifacts/contracts/BridgeForwarder.sol/BridgeForwarder.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  const BridgeForwarder = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  const endpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const owner = wallet.address;
  const caller = wallet.address;

  console.log("Raw Deploying BridgeForwarder...");
  const contract = await BridgeForwarder.deploy(endpoint, owner, caller);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log("✓ DEPLOYED TO:", address);
  
  // Link to Base Sepolia
  const dstEid = 40245;
  const dstBridge = "0xD3a967F16261C226Ed13ab8320ECB396cD7da0E5";
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);
  
  const tx = await (contract as any).setBridgeAddress(dstEid, dstBridgeBytes32);
  await tx.wait();
  console.log("✓ LINKED TO BASE SEPOLIA");
  console.log("FINAL_ADDRESS:" + address);
}

main().catch(console.error);
