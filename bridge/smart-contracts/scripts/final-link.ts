import { ethers } from "hardhat";

async function main() {
  const forwarderAddress = "0x19E88E3790A433721faD03CD5A68A100E18F40c4E";
  const dstEid = 40245;
  const dstBridge = "0xD3a967F16261C226Ed13ab8320ECB396cD7da0E5";
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);

  const [deployer] = await ethers.getSigners();
  console.log("Using signer:", deployer.address);
  
  const BridgeForwarder = await ethers.getContractAt("BridgeForwarder", forwarderAddress, deployer);
  
  console.log(`Setting EID ${dstEid} to ${dstBridgeBytes32}...`);
  const tx = await BridgeForwarder.setBridgeAddress(dstEid, dstBridgeBytes32);
  console.log("Transaction:", tx.hash);
  await tx.wait();
  console.log("✓ Success! Bridge link established.");
}

main().catch(console.error);
