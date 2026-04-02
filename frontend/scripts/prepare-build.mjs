import fs from 'node:fs';
import path from 'node:path';

const buildDirs = ['.next', '.next-build'].map((dir) => path.join(process.cwd(), dir));

for (const buildDir of buildDirs) {
  try {
    fs.rmSync(buildDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    console.log(`[prepare-build] Cleaned ${path.basename(buildDir)} directory`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[prepare-build] Failed to clean ${path.basename(buildDir)} directory: ${message}`);
  }
}
