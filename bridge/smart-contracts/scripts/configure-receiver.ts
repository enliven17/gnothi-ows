import { getEnvVar, validateAddress, addressToBytes32, getContract } from "./utils";
import { ethers } from "hardhat";

async function setTrustedForwarder() {
  const receiverAddress = getEnvVar("BRIDGE_RECEIVER_ADDRESS");
  const srcEid = parseInt(getEnvVar("SRC_EID"));
  const srcForwarderAddress = getEnvVar("SRC_FORWARDER_ADDRESS");

  validateAddress(receiverAddress, "BRIDGE_RECEIVER_ADDRESS");
  validateAddress(srcForwarderAddress, "SRC_FORWARDER_ADDRESS");

  console.log("\nSetting trusted forwarder on BridgeReceiver");
  console.log("  Receiver:", receiverAddress);
  console.log("  Source EID:", srcEid);
  console.log("  Source Forwarder:", srcForwarderAddress);

  const receiver = await getContract("BridgeReceiver", receiverAddress);
  const forwarderBytes32 = addressToBytes32(srcForwarderAddress);

  const tx = await receiver.setTrustedForwarder(srcEid, forwarderBytes32);
  console.log("  TX:", tx.hash);

  await tx.wait();
  console.log("  ✓ Trusted forwarder set successfully");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  await setTrustedForwarder();
}

main().catch((error) => {
  console.error("\nConfiguration failed!");
  console.error(error);
  process.exitCode = 1;
});
