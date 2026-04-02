import { ethers } from "hardhat";
import { AbiCoder } from "ethers";

// Resolution types matching BetCOFI.ResolutionType enum
const ResolutionType = {
  CRYPTO: 0,
  STOCKS: 1,
  NEWS: 2,
} as const;

// Helper to encode resolution data based on type
function encodeResolutionData(resolutionType: number): string {
  const abiCoder = AbiCoder.defaultAbiCoder();

  switch (resolutionType) {
    case ResolutionType.CRYPTO:
      // CRYPTO: (tokenSymbol, tokenName) - for CoinMarketCap lookup
      const tokenSymbol = process.env.TOKEN_SYMBOL || "BTC";
      const tokenName = process.env.TOKEN_NAME || "bitcoin";
      return abiCoder.encode(["string", "string"], [tokenSymbol, tokenName]);

    case ResolutionType.STOCKS:
      // STOCKS: (stockSymbol, companyName) - for stock price lookup
      const stockSymbol = process.env.STOCK_SYMBOL || "AAPL";
      const companyName = process.env.COMPANY_NAME || "apple";
      return abiCoder.encode(["string", "string"], [stockSymbol, companyName]);

    default:
      return "0x";
  }
}

async function main() {
  console.log("Creating a new bet via BetFactoryCOFI...\n");

  const [signer] = await ethers.getSigners();
  console.log(`Creating from address: ${signer.address}`);

  // Get factory address from environment variable
  const factoryAddress = process.env.FACTORY_ADDRESS;

  if (!factoryAddress) {
    throw new Error("FACTORY_ADDRESS environment variable not set!");
  }

  // Bet parameters - customize these
  const resolutionType = process.env.RESOLUTION_TYPE
    ? parseInt(process.env.RESOLUTION_TYPE)
    : ResolutionType.CRYPTO;
  const isNews = resolutionType === ResolutionType.NEWS;

  const newsQuestion =
    process.env.NEWS_QUESTION || "Did the announced event happen according to the linked source?";
  const newsEvidenceUrl =
    process.env.NEWS_EVIDENCE_URL || "https://www.reuters.com/";

  const betParams = {
    title: process.env.BET_TITLE || "Will BTC reach $150k by end of 2025?",
    resolutionCriteria: process.env.RESOLUTION_CRITERIA || "This bet resolves to YES if BTC price reaches $150,000 USD at any point before the end date.",
    sideAName: process.env.SIDE_A_NAME || "Yes",
    sideBName: process.env.SIDE_B_NAME || "No",
    // End date: 7 days from now by default
    endDate: process.env.END_DATE
      ? parseInt(process.env.END_DATE)
      : Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    resolutionType,
    resolutionData: isNews ? "0x" : encodeResolutionData(resolutionType),
  };

  console.log("\nBet Configuration:");
  console.log(`  Factory: ${factoryAddress}`);
  console.log(`  Title: ${betParams.title}`);
  console.log(`  Resolution Criteria: ${betParams.resolutionCriteria}`);
  console.log(`  Side A: ${betParams.sideAName}`);
  console.log(`  Side B: ${betParams.sideBName}`);
  console.log(`  End Date: ${new Date(betParams.endDate * 1000).toISOString()}`);
  console.log(`  Resolution Type: ${Object.keys(ResolutionType)[betParams.resolutionType]} (${betParams.resolutionType})`);
  if (isNews) {
    console.log(`  Question: ${newsQuestion}`);
    console.log(`  Evidence URL: ${newsEvidenceUrl}`);
  } else {
    console.log(`  Resolution Data: ${betParams.resolutionData}`);
  }

  // Get the factory contract
  const factory = await ethers.getContractAt("BetFactoryCOFI", factoryAddress);

  // Create the bet
  console.log("\nCreating bet...");
  const tx = isNews
    ? await factory.createNewsBet(
        betParams.title,
        newsQuestion,
        newsEvidenceUrl,
        betParams.sideAName,
        betParams.sideBName,
        betParams.endDate
      )
    : await factory.createBet(
        betParams.title,
        betParams.resolutionCriteria,
        betParams.sideAName,
        betParams.sideBName,
        betParams.endDate,
        betParams.resolutionType,
        betParams.resolutionData
      );

  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();

  // Get bet address from BetCreated event
  const betCreatedEvent = receipt?.logs.find((log: any) => {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
      return parsed?.name === "BetCreated";
    } catch {
      return false;
    }
  });

  let betAddress = "";
  if (betCreatedEvent) {
    const parsed = factory.interface.parseLog({
      topics: betCreatedEvent.topics as string[],
      data: betCreatedEvent.data
    });
    betAddress = parsed?.args[0];
  }

  console.log(`\n Bet created successfully!`);
  console.log(`   Bet address: ${betAddress}`);
  console.log(`   Creator: ${signer.address}`);
  console.log(`   Transaction: ${tx.hash}`);

  // Get bet count
  const betCount = await factory.getBetCount();
  console.log(`\nTotal bets in factory: ${betCount}`);

  // Schedule automated resolution via bridge service
  const bridgeUrl = process.env.BRIDGE_SERVICE_URL || 'http://localhost:3001';
  const endDateIso = new Date(betParams.endDate * 1000).toISOString();
  try {
    const scheduleRes = await fetch(`${bridgeUrl}/resolution/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractAddress: betAddress, endDate: endDateIso, marketTitle: betParams.title }),
      signal: AbortSignal.timeout(5000),
    });
    const scheduleJson = await scheduleRes.json() as { success: boolean; jobId?: string; message: string };
    if (scheduleJson.success) {
      console.log(`\n✅ Resolution scheduled with bridge: ${scheduleJson.jobId}`);
    } else {
      // Past-due or bridge rejected — try immediate execute
      const execRes = await fetch(`${bridgeUrl}/resolution/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: betAddress, marketTitle: betParams.title }),
        signal: AbortSignal.timeout(10000),
      });
      const execJson = await execRes.json() as { success: boolean; message: string };
      console.log(`\n${execJson.success ? '✅' : '⚠️'} Bridge execute: ${execJson.message}`);
    }
  } catch (e: any) {
    console.warn(`\n⚠️  Bridge not reachable (${bridgeUrl}): ${e.message}`);
    console.warn('   Run bridge service and call POST /resolution/execute manually.');
  }

  console.log("\n Next steps:");
  console.log("1. Users can place bets via factory.placeBet(betAddress, onSideA, amount, probability)");
  console.log("2. After end date, creator calls bet.resolve() to request resolution");
  console.log("3. GenLayer oracle sends resolution via bridge");
  console.log("4. Winners call bet.claim() to collect winnings");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
