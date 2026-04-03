import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ZKSYNC_SEPOLIA_RPC_URL);
  const forwarderAddress = "0x70CA1E3B7451D1560D64A4675158F864996099aE";
  const forwarder = new ethers.Contract(forwarderAddress, ["function endpoint() view returns (address)"], provider);

  const endpointAddress = await forwarder.endpoint();
  console.log("Endpoint on contract:", endpointAddress);
}

main().catch(console.error);
