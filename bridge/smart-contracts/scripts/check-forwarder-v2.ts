import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const BRIDGE_FORWARDER_ABI = [
  "function OWNER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function getRoleMemberCount(bytes32 role) view returns (uint256)",
  "function getRoleMember(bytes32 role, uint256 index) view returns (address)",
  "function bridgeAddresses(uint32) view returns (bytes32)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ZKSYNC_SEPOLIA_RPC_URL);
  const forwarderAddress = "0x70CA1E3B7451D1560D64A4675158F864996099aE";
  
  const code = await provider.getCode(forwarderAddress);
  console.log("Code at address:", code === "0x" ? "EMPTY" : "EXISTS (" + code.length + " bytes)");

  if (code !== "0x") {
      const forwarder = new ethers.Contract(forwarderAddress, BRIDGE_FORWARDER_ABI, provider);
      
      const bridge40245 = await forwarder.bridgeAddresses(40245);
      console.log("Bridge 40245:", bridge40245);
      
      const ownerRole = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
      const count = await forwarder.getRoleMemberCount(ownerRole);
      console.log("Owner count:", count.toString());
  }
}

main().catch(console.error);
