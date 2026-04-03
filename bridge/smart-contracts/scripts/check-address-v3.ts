import { ethers } from "ethers";

const addr = "0x19E88E3790A433721faD03CD5A68A100E18F40c4E";
console.log("Address:", addr);
console.log("Length: ", addr.length);
console.log("isAddress:", ethers.isAddress(addr));

try {
  console.log("Checksummed:", ethers.getAddress(addr));
} catch (e: any) {
  console.error("Checksum error:", e.message);
}
