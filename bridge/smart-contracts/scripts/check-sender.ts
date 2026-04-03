import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const sender = "0xBbCd3EF47cBdDa7Fb93fDc3a8B0Ee9cE31bce10b";
  const code = await provider.getCode(sender);
  console.log("Sender Address:", sender);
  console.log("Code length:", code.length > 2 ? code.length / 2 - 1 : 0);
}

main().catch(console.error);
