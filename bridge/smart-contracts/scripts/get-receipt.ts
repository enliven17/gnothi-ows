import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const hash = "0x2870e3b6ed6f45e0b422764ec20ffc43"; // Wait! I need to get the REAL hash.
}
