import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const ABI = [
  "function hasRole(bytes32 role, address account) public view returns (bool)",
  "function OWNER_ROLE() public view returns (bytes32)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.era.zksync.dev");
  const forwarder = "0x70CA1E3B7451D1560D64A4675158F864996099aE";
  const wallet = "0x71197e7a1CA5A2cb2AAD82432B924F69B1E3dB123";
  
  const contract = new ethers.Contract(forwarder, ABI, provider);
  const ownerRole = await contract.OWNER_ROLE();
  const isOwner = await contract.hasRole(ownerRole, wallet);
  
  console.log("Original Forwarder:", forwarder);
  console.log("Is current wallet owner?:", isOwner);
}

main().catch(console.error);
