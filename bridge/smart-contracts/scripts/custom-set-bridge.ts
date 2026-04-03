import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const forwarderAddress = process.env.BRIDGE_FORWARDER_ADDRESS;
  const dstEid = 40245;
  const dstBridge = "0xD3a967F16261C226Ed13ab8320ECB396cD7da0E5";
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);

  console.log("Setting bridge address...");
  console.log("Forwarder:", forwarderAddress);
  console.log("EID:", dstEid);
  console.log("Dst Bridge:", dstBridgeBytes32);

  const forwarder = await ethers.getContractAt("BridgeForwarder", forwarderAddress || "");
  const tx = await forwarder.setBridgeAddress(dstEid, dstBridgeBytes32);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Success!");
}

main().catch(console.error);
