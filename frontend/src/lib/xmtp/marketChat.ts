'use client';

import type { Client, Conversation } from '@xmtp/browser-sdk';

// Market group conversations are stored by marketId
const groupCache = new Map<string, Conversation>();

/**
 * Get or create the XMTP group conversation for a prediction market.
 * The group is identified by the market contract address.
 */
export async function getOrCreateMarketGroup(
  client: Client,
  marketId: string,
  marketTitle: string
): Promise<Conversation> {
  if (groupCache.has(marketId)) {
    return groupCache.get(marketId)!;
  }

  // Sync existing conversations first
  await client.conversations.sync();
  const existing = await client.conversations.list();

  // Look for an existing group with this marketId in the group name
  const found = existing.find(
    (c) => c.name === `gnothi:market:${marketId}`
  );

  if (found) {
    groupCache.set(marketId, found);
    return found;
  }

  // Create new group conversation for this market
  const group = await client.conversations.newGroup([], {
    name: `gnothi:market:${marketId}`,
    description: marketTitle,
    imageUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${marketId}`,
  });

  groupCache.set(marketId, group);
  return group;
}

/**
 * Send a message to the market group chat.
 */
export async function sendMarketMessage(
  group: Conversation,
  text: string
): Promise<void> {
  await group.send(text);
}

/**
 * Stream messages from a market group chat.
 * Returns an unsubscribe function.
 */
export function streamMarketMessages(
  group: Conversation,
  onMessage: (msg: { senderInboxId: string; content: string; sentAt: Date }) => void
): () => void {
  let stopped = false;

  (async () => {
    try {
      await group.stream(async (error, message) => {
        if (stopped) return;
        if (error) {
          console.error('[XMTP] stream error:', error);
          return;
        }
        if (!message) return;
        onMessage({
          senderInboxId: message.senderInboxId,
          content: typeof message.content === 'string' ? message.content : '',
          sentAt: new Date(message.sentAtNs ? Number(message.sentAtNs) / 1_000_000 : Date.now()),
        });
      });
    } catch (err) {
      if (!stopped) console.error('[XMTP] stream failed:', err);
    }
  })();

  return () => {
    stopped = true;
  };
}

/**
 * Load recent message history from a market group.
 */
export async function loadMarketMessages(
  group: Conversation,
  limit = 50
): Promise<Array<{ senderInboxId: string; content: string; sentAt: Date }>> {
  await group.sync();
  const messages = await group.messages({ limit });

  return messages
    .filter((m) => typeof m.content === 'string' && m.content.length > 0)
    .map((m) => ({
      senderInboxId: m.senderInboxId,
      content: m.content as string,
      sentAt: new Date(m.sentAtNs ? Number(m.sentAtNs) / 1_000_000 : Date.now()),
    }));
}
