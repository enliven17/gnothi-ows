import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const bridgeReceiverAddress = process.env.BRIDGE_RECEIVER_ADDRESS;

  if (!factoryAddress || !bridgeReceiverAddress) {
    throw new Error("Missing FACTORY_ADDRESS or BRIDGE_RECEIVER_ADDRESS in .env");
  }

  const [signer] = await ethers.getSigners();
  console.log(`Setting bridge receiver from address: ${signer.address}`);
  console.log(`Factory:         ${factoryAddress}`);
  console.log(`Bridge Receiver: ${bridgeReceiverAddress}`);

  const factory = await ethers.getContractAt("BetFactoryCOFI", factoryAddress);
  
  const current = await factory.bridgeReceiver();
  console.log(`Current value:   ${current}`);

  if (current.toLowerCase() === bridgeReceiverAddress.toLowerCase()) {
    console.log("✓ Value is already correctly set.");
    return;
  }

  // Check owner
  const owner = await factory.owner();
  console.log(`Factory owner:  ${owner}`);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`FATAL: Current signer ${signer.address} is NOT the owner ${owner}`);
    process.exit(1);
  }

  console.log("Sending transaction...");
  const tx = await factory.setBridgeReceiver(bridgeReceiverAddress);
  console.log(`TX Hash: ${tx.hash}`);
  await tx.wait();
  console.log("✓ Bridge receiver updated successfully!");
}

main().catch(console.error);
