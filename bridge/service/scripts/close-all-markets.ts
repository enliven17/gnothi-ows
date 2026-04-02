/**
 * Close All Markets - One-shot script
 *
 * Reads every market from the factory and:
 *   - ACTIVE + past end date  → calls resolve() (moves to RESOLVING, triggers oracle)
 *   - RESOLVING               → lists them (StuckResolvingScanner will re-deploy oracle if needed)
 *   - RESOLVED / UNDETERMINED → skips
 *
 * Usage:
 *   npx tsx scripts/close-all-markets.ts
 *   DRY_RUN=true npx tsx scripts/close-all-markets.ts   (preview only, no txs)
 */

import { ethers } from "ethers";
import { getBaseSepoliaRpcUrl, getBetFactoryAddress, getPrivateKey } from "../src/config.js";

const DRY_RUN = process.env.DRY_RUN === "true";

const FACTORY_ABI = [
  "function allBets(uint256 index) view returns (address)",
  "function getBetCount() view returns (uint256)",
];

const BET_ABI = [
  "function status() view returns (uint8)",
  "function endDate() view returns (uint256)",
  "function title() view returns (string)",
  "function resolve()",
  "function creator() view returns (address)",
  "function factory() view returns (address)",
];

const FACTORY_CHECK_ABI = [
  "function canResolveBet(address caller, address creator) view returns (bool)",
];

const STATUS_NAMES = ["ACTIVE", "RESOLVING", "RESOLVED", "UNDETERMINED"];

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(getBaseSepoliaRpcUrl());
  const wallet = new ethers.Wallet(getPrivateKey(), provider);
  const factoryAddr = getBetFactoryAddress();
  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, provider);

  console.log(`[close-all] Wallet: ${wallet.address}`);
  console.log(`[close-all] Factory: ${factoryAddr}`);
  console.log(`[close-all] DRY_RUN: ${DRY_RUN}`);
  console.log();

  const count = Number(await factory.getBetCount());
  console.log(`[close-all] Total markets: ${count}\n`);

  const now = Math.floor(Date.now() / 1000);
  const toResolve: { addr: string; title: string }[] = [];
  const resolving: { addr: string; title: string }[] = [];

  // Collect market statuses in batches
  const BATCH = 5;
  for (let i = 0; i < count; i += BATCH) {
    const end = Math.min(i + BATCH, count);
    const addrs: string[] = await Promise.all(
      Array.from({ length: end - i }, (_, j) => factory.allBets(i + j))
    );

    await Promise.all(
      addrs.map(async (addr) => {
        try {
          const bet = new ethers.Contract(addr, BET_ABI, provider);
          const [status, endDate, title] = await Promise.all([
            bet.status(),
            bet.endDate(),
            bet.title(),
          ]);
          const s = Number(status);
          const e = Number(endDate);

          if (s === 0 && e < now) {
            toResolve.push({ addr, title });
          } else if (s === 1) {
            resolving.push({ addr, title });
          }
        } catch {
          // skip broken markets
        }
      })
    );

    if (i + BATCH < count) await sleep(300);
  }

  console.log(`Found ${toResolve.length} ACTIVE+expired market(s) to resolve`);
  console.log(`Found ${resolving.length} RESOLVING market(s) (waiting for oracle)\n`);

  if (resolving.length > 0) {
    console.log("--- RESOLVING (oracle pending, StuckResolvingScanner will handle) ---");
    for (const { addr, title } of resolving) {
      console.log(`  ${addr}  ${title}`);
    }
    console.log();
  }

  if (toResolve.length === 0) {
    console.log("Nothing to resolve. Done.");
    return;
  }

  console.log("--- Resolving ACTIVE+expired markets ---");

  let resolved = 0;
  let failed = 0;

  for (const { addr, title } of toResolve) {
    try {
      const bet = new ethers.Contract(addr, BET_ABI, wallet);

      // Check authorization
      const creator = await bet.creator();
      const factoryCheckAddr = await bet.factory();
      const factoryCheck = new ethers.Contract(factoryCheckAddr, FACTORY_CHECK_ABI, provider);
      const canResolve = await factoryCheck.canResolveBet(wallet.address, creator);
      if (!canResolve) {
        console.log(`  SKIP (not authorized): ${title}`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would resolve: ${title} (${addr})`);
        resolved++;
        continue;
      }

      console.log(`  Resolving: ${title}`);
      const tx = await bet.resolve();
      await tx.wait(1);
      console.log(`  ✓ TX: ${tx.hash}`);
      resolved++;

      await sleep(3000); // avoid nonce collisions
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      // "not in ACTIVE" means already moved — not a real error
      if (msg.includes("not in ACTIVE") || msg.includes("not ACTIVE")) {
        console.log(`  SKIP (already moved): ${title}`);
      } else {
        console.error(`  ✗ Failed: ${title} — ${msg.slice(0, 120)}`);
        failed++;
      }
    }
  }

  console.log(`\nDone. Resolved: ${resolved}, Failed: ${failed}`);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
