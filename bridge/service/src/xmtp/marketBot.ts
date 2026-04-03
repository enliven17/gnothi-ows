/**
 * MarketBot — XMTP agent that broadcasts market lifecycle events to group chats.
 *
 * The bridge service calls these helpers at key moments:
 *  - Market created
 *  - Bet placed
 *  - Resolution started
 *  - AI validator votes
 *  - Market resolved + payout info
 *
 * The bot runs as a dedicated XMTP identity (bot wallet private key in .env).
 * It joins the group chat for each market and posts structured update messages.
 */

import { Client, type Signer, type Group, IdentifierKind } from '@xmtp/node-sdk';
import { ethers } from 'ethers';
import crypto from 'crypto';

let botClient: Client | null = null;

/**
 * Initialize the XMTP bot client using the bot's private key from env.
 */
async function getBotClient(): Promise<Client> {
  if (botClient) return botClient;

  const privateKey = process.env.XMTP_BOT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('XMTP_BOT_PRIVATE_KEY not set in environment');
  }

  const wallet = new ethers.Wallet(privateKey);

  const signer: Signer = {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: wallet.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const sig = await wallet.signMessage(message);
      const hex = sig.startsWith('0x') ? sig.slice(2) : sig;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    },
  };

  const dbEncryptionKey = crypto
    .createHash('sha256')
    .update(`gnothi-bot-${wallet.address}`)
    .digest();

  botClient = await Client.create(signer, {
    dbEncryptionKey: new Uint8Array(dbEncryptionKey),
    env: 'dev',
  });

  console.log('[MarketBot] XMTP client initialized. InboxId:', botClient.inboxId);
  return botClient;
}

/**
 * Get or create the XMTP group conversation for a market.
 */
async function getMarketGroup(client: Client, marketId: string, marketTitle: string) {
  await client.conversations.sync();
  const all = await client.conversations.list();

  const targetName = `gnothi:market:${marketId}`;
  const existing = all.find((c) => 'name' in c && (c as unknown as Group).name === targetName);
  if (existing) return existing as unknown as Group;

  return await client.conversations.newGroup([], {
    groupName: targetName,
    groupDescription: marketTitle,
  }) as unknown as Group;
}

/**
 * Post a message to the market's XMTP group chat.
 */
async function postToMarket(marketId: string, marketTitle: string, message: string): Promise<void> {
  try {
    const client = await getBotClient();
    const group = await getMarketGroup(client, marketId, marketTitle);
    await group.send(message);
    console.log(`[MarketBot] Posted to market ${marketId}: ${message.slice(0, 80)}`);
  } catch (err) {
    // Never throw — bot failures should not break the resolution pipeline
    console.error('[MarketBot] Failed to post message:', err);
  }
}

// ─── Public event emitters ────────────────────────────────────────────────────

export async function notifyMarketCreated(
  marketId: string,
  title: string,
  sideA: string,
  sideB: string,
  endDate: string
): Promise<void> {
  await postToMarket(
    marketId,
    title,
    `🎯 New market opened!\n\n"${title}"\n\n` +
    `📊 Side A: ${sideA}\n📊 Side B: ${sideB}\n⏰ Closes: ${endDate}\n\n` +
    `Place your bets — use confidence 1-99% to maximize your SCEM score.`
  );
}

export async function notifyBetPlaced(
  marketId: string,
  title: string,
  side: 'A' | 'B',
  sideName: string,
  confidence: number,
  amount: string,
  traderAddress: string
): Promise<void> {
  const short = `${traderAddress.slice(0, 6)}…${traderAddress.slice(-4)}`;
  await postToMarket(
    marketId,
    title,
    `📥 New bet: ${short} → Side ${side} (${sideName}) at ${confidence}% confidence for ${amount} USDC`
  );
}

export async function notifyResolutionStarted(marketId: string, title: string): Promise<void> {
  await postToMarket(
    marketId,
    title,
    `⏳ Trading closed. GenLayer AI validators are now resolving this market.\n` +
    `5 independent LLMs are scanning the web for evidence…`
  );
}

export async function notifyValidatorVote(
  marketId: string,
  title: string,
  validatorIndex: number,
  vote: 'SIDE_A' | 'SIDE_B' | 'UNDECIDED',
  confidence: string
): Promise<void> {
  const emoji = vote === 'SIDE_A' ? '🟢' : vote === 'SIDE_B' ? '🔴' : '⚪';
  await postToMarket(
    marketId,
    title,
    `${emoji} Validator ${validatorIndex + 1}/5 voted: ${vote} (${confidence})`
  );
}

export async function notifyResolved(
  marketId: string,
  title: string,
  winner: 'SIDE_A' | 'SIDE_B' | 'UNDETERMINED',
  winnerName: string,
  totalPayout: string,
  winnerCount: number
): Promise<void> {
  if (winner === 'UNDETERMINED') {
    await postToMarket(
      marketId,
      title,
      `⚪ Market resolved as UNDETERMINED — AI validators could not reach consensus.\n` +
      `All bets have been refunded.`
    );
    return;
  }

  await postToMarket(
    marketId,
    title,
    `✅ Market resolved!\n\n` +
    `🏆 Winner: ${winnerName}\n` +
    `💰 Total payout pool: ${totalPayout} USDC\n` +
    `👥 Winners: ${winnerCount}\n\n` +
    `Go to the market page to claim your SCEM-weighted reward.`
  );
}
