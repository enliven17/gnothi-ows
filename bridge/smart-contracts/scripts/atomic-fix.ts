import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const endpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const owner = deployer.address;
  const caller = deployer.address;

  console.log("Deploying Atomic BridgeForwarder...");
  const BridgeForwarder = await ethers.getContractFactory("BridgeForwarder");
  const contract = await BridgeForwarder.deploy(endpoint, owner, caller);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log("Deployed to:", address);
  console.log("Length:", address.length); // Should be 42

  const dstEid = 40245;
  const dstBridge = "0xD3a967F16261C226Ed13ab8320ECB396cD7da0E5";
  const dstBridgeBytes32 = ethers.zeroPadValue(dstBridge, 32);

  console.log("Linking EID 40245...");
  const tx = await contract.setBridgeAddress(dstEid, dstBridgeBytes32);
  await tx.wait();
  
  console.log("✓ SUCCESS: Atomic Deploy & Link Complete!");
  console.log("FINAL_BRIDGE_FORWARDER_ADDRESS:" + address);
}

main().catch(console.error);
