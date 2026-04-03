import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.FORWARDER_NETWORK_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`Balance:        ${ethers.formatEther(balance)} ETH`);
}

main().catch(console.error);
