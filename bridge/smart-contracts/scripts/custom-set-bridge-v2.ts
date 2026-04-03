import { ethers } from "hardhat";

async function main() {
  const forwarderAddress = "0x19E88E3790A433721faD03CD5A68A100E18F40c4E";
  const dstEid = 40245;
  const dstBridge = "0xD3a967F16261C226Ed13ab8320ECB396cD7da0E5";
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);

  console.log("Setting bridge address on:", forwarderAddress);
  const [deployer] = await ethers.getSigners();
  console.log("Signer:", deployer.address);

  const forwarder = await ethers.getContractAt("BridgeForwarder", forwarderAddress);
  const tx = await forwarder.setBridgeAddress(dstEid, dstBridgeBytes32);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✓ Success!");
}

main().catch(console.error);
