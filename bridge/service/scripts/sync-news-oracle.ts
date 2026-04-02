/**
 * Sync the canonical NEWS oracle into the service deployment directory.
 *
 * Source of truth:
 *   bridge/intelligent-contracts/news_pm.py
 *
 * Deployment copy:
 *   bridge/service/intelligent-oracles/news_pm.py
 */

import { copyFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = path.resolve(__dirname, "../../intelligent-contracts/news_pm.py");
const targetPath = path.resolve(__dirname, "../intelligent-oracles/news_pm.py");

if (!existsSync(sourcePath)) {
  throw new Error(`Canonical NEWS oracle not found: ${sourcePath}`);
}

copyFileSync(sourcePath, targetPath);

console.log("Synced NEWS oracle");
console.log(`  Source: ${sourcePath}`);
console.log(`  Target: ${targetPath}`);
