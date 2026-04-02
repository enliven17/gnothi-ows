import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const genlayerRpcUrl = process.env.GENLAYER_RPC_URL || "https://studio-stage.genlayer.com/api";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing required env var: PRIVATE_KEY");
  }

  console.log("\n========================================");
  console.log("  Deploying BridgeSender to GenLayer");
  console.log("========================================");
  console.log(`GenLayer RPC: ${genlayerRpcUrl}`);

  // Create GenLayer client
  const account = createAccount(`0x${privateKey.replace(/^0x/, "")}`);
  const client = createClient({
    chain: {
      ...studionet,
      rpcUrls: {
        default: { http: [genlayerRpcUrl] },
      },
    },
    account,
  });

  console.log(`\nAccount: ${account.address}`);

  // Load BridgeSender contract code
  const contractPath = path.join(process.cwd(), "../intelligent-contracts/BridgeSender.py");
  console.log(`\nLoading contract from: ${contractPath}`);
  const code = readFileSync(contractPath, "utf-8");

  try {
    console.log("\n--- Deploying BridgeSender ---");
    const hash = await client.deployContract({
      code: code,
      args: [], // No constructor arguments
      leaderOnly: false,
    });

    console.log(`\nDeploy TX Hash: ${hash}`);
    console.log("Waiting for deployment...");

    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED",
      retries: 60,
      interval: 2000,
    });

    const address = receipt.data?.contract_address;
    console.log(`\n--- Deployment Complete ---`);
    console.log(`BridgeSender Address: ${address}`);
    console.log(`Status: ${receipt.status_name} (${receipt.status})`);

    if (address) {
      console.log("\n✅ Success! Update your .env with:");
      console.log(`BRIDGE_SENDER_ADDRESS=${address}`);
      
      const fs = await import("fs");
      fs.writeFileSync("bridge-sender-address.json", JSON.stringify({ address }));
    }
  } catch (error) {
    console.error("\nDeployment error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
