import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const endpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const owner = deployer.address;
  const caller = deployer.address;

  const BridgeForwarder = await ethers.getContractFactory("BridgeForwarder");
  const contract = await BridgeForwarder.deploy(endpoint, owner, caller);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("FINAL_ADDRESS:" + address);
}

main().catch(console.error);
