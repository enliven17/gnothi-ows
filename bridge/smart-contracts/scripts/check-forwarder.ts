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
  const forwarderAddress = process.env.BRIDGE_FORWARDER_ADDRESS || "0x70CA1E3B7451D1560D64A4675158F864996099aE";
  const forwarder = new ethers.Contract(forwarderAddress, BRIDGE_FORWARDER_ABI, provider);

  const ownerRole = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
  const adminRole = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log("Forwarder:", forwarderAddress);
  
  const count = await forwarder.getRoleMemberCount(ownerRole);
  console.log("Owner count:", count.toString());
  if (count > 0) {
    const firstOwner = await forwarder.getRoleMember(ownerRole, 0);
    console.log("First owner:", firstOwner);
  }

  const adminCount = await forwarder.getRoleMemberCount(adminRole);
  console.log("Admin count:", adminCount.toString());
  if (adminCount > 0) {
      const firstAdmin = await forwarder.getRoleMember(adminRole, 0);
      console.log("First admin:", firstAdmin);
  }

  const bridge40245 = await forwarder.bridgeAddresses(40245);
  console.log("Bridge 40245:", bridge40245);
}

main().catch(console.error);
