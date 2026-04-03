import { Wallet } from "zksync-ethers";
import * as ethers from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import dotenv from "dotenv";
dotenv.config();

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`\n--- Starting zkSync Deployment ---`);
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);
  
  const artifact = await deployer.loadArtifact("BridgeForwarder");
  
  const endpoint = process.env.ZKSYNC_ENDPOINT_V2 || process.env.ZKSYNC_SEPOLIA_ENDPOINT_V2;
  const owner = process.env.OWNER_ADDRESS || wallet.address;
  const caller = process.env.CALLER_ADDRESS || wallet.address;
  const dstBridge = process.env.DST_BRIDGE_ADDRESS || process.env.BRIDGE_RECEIVER_ADDRESS;

  if (!endpoint) {
    throw new Error("Missing ZKSYNC_ENDPOINT_V2 or ZKSYNC_SEPOLIA_ENDPOINT_V2");
  }
  if (!dstBridge) {
    throw new Error("Missing DST_BRIDGE_ADDRESS or BRIDGE_RECEIVER_ADDRESS");
  }

  console.log(`Deploying from: ${wallet.address}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Owner: ${owner}`);
  console.log(`Caller: ${caller}`);
  
  const contract = await deployer.deploy(artifact, [endpoint, owner, caller]);
  const address = await contract.getAddress();
  
  console.log(`✓ DEPLOYED TO: ${address}`);

  // Link to Base Sepolia
  const dstEid = 40245;
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);
  
  console.log(`Linking to Base Sepolia...`);
  const tx = await contract.setBridgeAddress(dstEid, dstBridgeBytes32);
  await tx.wait();
  
  console.log(`✓ ATOMICALLY LINKED`);
  console.log(`FINAL_ADDRESS:${address}`);
}
