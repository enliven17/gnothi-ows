import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const forwarder = "0x673c13bfc6fdeb9910fb7d9c6bb85937d46d0c5e";
  const code = await provider.getCode(forwarder);
  console.log("Forwarder:", forwarder);
  console.log("Code length:", code.length > 2 ? code.length / 2 - 1 : 0);
}

main().catch(console.error);
