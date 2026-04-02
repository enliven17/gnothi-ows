import { ethers } from "hardhat";

const FACTORY_ABI = [
  "function activeBets(uint256) external view returns (address)",
  "function getActiveBetCount() external view returns (uint256)",
  "function allBets(uint256) external view returns (address)",
];

const BET_ABI = [
  "function status() external view returns (uint8)",
  "function endDate() external view returns (uint256)",
  "function title() external view returns (string)",
  "function resolve() external",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const factory = await ethers.getContractAt("BetFactoryCOFI", process.env.FACTORY_ADDRESS!);
  const bridgeUrl = process.env.BRIDGE_URL || "http://localhost:3001";
  const now = Math.floor(Date.now() / 1000);

  // Get all bets by iterating allBets array
  let i = 0;
  const expired: string[] = [];

  while (true) {
    try {
      const addr: string = await (factory as any).allBets(i);
      const bet = new ethers.Contract(addr, BET_ABI, signer);
      const [status, endDate, title] = await Promise.all([
        bet.status(),
        bet.endDate(),
        bet.title(),
      ]);

      const statusNum = Number(status);
      const endDateNum = Number(endDate);
      const isExpired = endDateNum < now;
      const isActive = statusNum === 0;

      console.log(`[${i}] ${addr.slice(0,10)}... status=${statusNum} expired=${isExpired} title="${title.slice(0,40)}"`);

      if (isActive && isExpired) {
        expired.push(addr);
      }
      i++;
    } catch {
      break;
    }
  }

  console.log(`\nFound ${expired.length} expired ACTIVE markets to resolve.`);

  for (const addr of expired) {
    try {
      const res = await fetch(`${bridgeUrl}/resolution/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress: addr, marketTitle: addr }),
      });
      const json = await res.json() as any;
      console.log(`${addr}: ${json.message}`);
    } catch (e: any) {
      console.error(`${addr}: fetch error — ${e.message}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
