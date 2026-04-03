import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const FACTORY_ABI = [
  "function bridgeReceiver() view returns (address)",
  "function owner() view returns (address)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const factoryAddress = "0xC2F959930D13d2796ceFaE4203E376c53f79fB98";
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);

  const receiver = await factory.bridgeReceiver();
  const owner = await factory.owner();

  console.log("Factory:", factoryAddress);
  console.log("Bridge Receiver:", receiver);
  console.log("Factory Owner:", owner);
}

main().catch(console.error);
