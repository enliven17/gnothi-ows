/**
 * Bridge Service - Entry Point
 *
 * Bidirectional relay service:
 * - GenLayer → EVM: Polls GenLayer and relays via LayerZero
 * - EVM → GenLayer: Listens for events and deploys intelligent oracles to GenLayer
 * - Automated Resolution: Schedules and executes market resolutions at exact end dates
 */

import cron from "node-cron";
import { getBridgeSyncInterval, getOptionalConfig, getHttpPort } from "./config.js";
import { GenLayerToEvmRelay } from "./relay/GenLayerToEvm.js";
import { EvmToGenLayerRelay } from "./relay/EvmToGenLayer.js";
import { ResolutionQueue } from "./resolution/ResolutionQueue.js";
import { ResolutionAPI } from "./api/ResolutionAPI.js";
import { LoopMarketScheduler } from "./resolution/LoopMarketScheduler.js";
import { ExpiredMarketSweeper } from "./resolution/ExpiredMarketSweeper.js";
import { StuckResolvingScanner } from "./resolution/StuckResolvingScanner.js";
import { initOWSVault, isOWSAvailable } from "./ows/OWSVault.js";

// Global references for graceful shutdown
let resolutionQueue: ResolutionQueue | null = null;
let loopScheduler: LoopMarketScheduler | null = null;
let httpServer: any = null;

async function main() {
  console.log("Starting Bridge Service\n");

  // OWS Vault — import relay private key into encrypted vault (Linux/Railway only)
  const callerKey = process.env.CALLER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? '';
  if (callerKey) {
    await initOWSVault(callerKey);
    console.log(`[OWS] Vault initialized — native SDK ${isOWSAvailable() ? 'active' : 'unavailable (ethers fallback)'}`);
  }

  // GenLayer → EVM (polling)
  console.log("[GL→EVM] Initializing...");
  const glToEvm = new GenLayerToEvmRelay();
  const glToEvmInterval = getBridgeSyncInterval();
  console.log(`[GL→EVM] Sync interval: ${glToEvmInterval}`);
  glToEvm.sync();
  cron.schedule(glToEvmInterval, () => glToEvm.sync());

  // EVM → GenLayer (event listening)
  const betFactoryAddress = getOptionalConfig("betFactoryAddress", "BET_FACTORY_ADDRESS");
  if (betFactoryAddress) {
    console.log("\n[EVM→GL] Initializing...");
    const evmToGl = new EvmToGenLayerRelay();
    evmToGl.startListening();
  } else {
    console.log("\n[EVM→GL] Skipped (BET_FACTORY_ADDRESS not set)");
  }

  // Automated Resolution Service (must init before LoopMarketScheduler)
  console.log("\n[RESOLUTION] Initializing...");
  resolutionQueue = new ResolutionQueue();

  // Expired Market Sweeper — resolves any ACTIVE markets past their end date
  if (betFactoryAddress) {
    const sweeper = new ExpiredMarketSweeper();
    sweeper.start();

    // Stuck Resolving Scanner — re-deploys missing oracles for RESOLVING markets
    const stuckScanner = new StuckResolvingScanner();
    stuckScanner.start();
  }

  // Loop Markets (BTC + ETH 5-min direction markets)
  if (betFactoryAddress && process.env.LOOP_MARKETS_ENABLED === 'true') {
    console.log("\n[LoopMarket] Initializing...");
    loopScheduler = new LoopMarketScheduler(resolutionQueue);
    await loopScheduler.start();
  }
  const resolutionAPI = new ResolutionAPI(resolutionQueue, loopScheduler ?? undefined);
  const httpPort = getHttpPort();

  // Start HTTP server
  httpServer = resolutionAPI.getApp().listen(httpPort, '0.0.0.0', () => {
    console.log(`[RESOLUTION] HTTP API listening on port ${httpPort}`);
    console.log(`[RESOLUTION] Endpoints:`);
    console.log(`  POST /resolution/schedule - Schedule market resolution`);
    console.log(`  GET  /resolution/queue    - View resolution queue`);
    console.log(`  GET  /health             - Health check`);
  });

  console.log("\nBridge service running (all components active)");
  console.log("Services:");
  console.log("  ✓ GenLayer → EVM relay");
  console.log(`  ${betFactoryAddress ? '✓' : '✗'} EVM → GenLayer relay`);
  console.log("  ✓ Automated resolution service");
  console.log("  ✓ HTTP API");
  console.log(`  ${loopScheduler ? '✓' : '✗'} Loop markets (BTC/ETH 5-min)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Shutdown resolution queue (cancel cron jobs and save state)
  if (resolutionQueue) {
    console.log("Shutting down resolution queue...");
    resolutionQueue.shutdown();
  }

  // Shutdown loop scheduler
  if (loopScheduler) {
    console.log("Shutting down loop markets...");
    loopScheduler.stop();
  }

  // Close HTTP server
  if (httpServer) {
    console.log("Closing HTTP server...");
    httpServer.close(() => {
      console.log("HTTP server closed");
    });
  }

  console.log("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
