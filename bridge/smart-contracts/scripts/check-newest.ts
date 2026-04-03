import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const forwarder = "0x27f549d61c6949bf7004605ba22681180b2b6811";
  const code = await provider.getCode(forwarder);
  console.log("Forwarder:", forwarder);
  console.log("Code length:", code.length > 2 ? code.length / 2 - 1 : 0);
}

main().catch(console.error);
