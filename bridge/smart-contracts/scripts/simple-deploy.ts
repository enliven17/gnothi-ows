import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const endpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const owner = deployer.address;
  const caller = deployer.address;

  console.log("Endpoint:", endpoint);
  console.log("Owner:", owner);
  console.log("Caller:", caller);

  const BridgeForwarder = await ethers.getContractFactory("BridgeForwarder");
  console.log("Deploying...");
  const contract = await BridgeForwarder.deploy(endpoint, owner, caller);
  await contract.waitForDeployment();
  console.log("Deployed to:", await contract.getAddress());
}

main().catch(console.error);
