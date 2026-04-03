'use client';

import type { Client, Group } from '@xmtp/browser-sdk';

// Market group conversations are stored by marketId
const groupCache = new Map<string, Group>();

/**
 * Get or create the XMTP group conversation for a prediction market.
 */
export async function getOrCreateMarketGroup(
  client: Client,
  marketId: string,
  marketTitle: string
): Promise<Group> {
  if (groupCache.has(marketId)) {
    return groupCache.get(marketId)!;
  }

  await client.conversations.sync();
  const existing = await client.conversations.list();

  const targetName = `gnothi:market:${marketId}`;
  // Filter only Group conversations (have 'name' property, unlike DMs)
  const found = existing.find((c) => 'name' in c && (c as unknown as Group).name === targetName);

  if (found) {
    const group = found as unknown as Group;
    groupCache.set(marketId, group);
    return group;
  }

  // Create new group conversation for this market
  const group = await client.conversations.newGroup([], {
    name: targetName,
    description: marketTitle,
  });

  groupCache.set(marketId, group);
  return group;
}

/**
 * Send a message to the market group chat.
 */
export async function sendMarketMessage(
  group: Group,
  text: string
): Promise<void> {
  await group.send(text);
}

/**
 * Stream messages from a market group chat.
 * Returns an unsubscribe function.
 */
export function streamMarketMessages(
  group: Group,
  onMessage: (msg: { senderInboxId: string; content: string; sentAt: Date }) => void
): () => void {
  let stopped = false;

  (async () => {
    try {
      const stream = await group.stream();
      for await (const message of stream) {
        if (stopped) break;
        if (!message) continue;
        onMessage({
          senderInboxId: message.senderInboxId,
          content: typeof message.content === 'string' ? message.content : '',
          sentAt: new Date(message.sentAtNs ? Number(message.sentAtNs) / 1_000_000 : Date.now()),
        });
      }
    } catch (err) {
      if (!stopped) console.error('[XMTP] stream failed:', err);
    }
  })();

  return () => { stopped = true; };
}

/**
 * Load recent message history from a market group.
 */
export async function loadMarketMessages(
  group: Group,
  limit = 50
): Promise<Array<{ senderInboxId: string; content: string; sentAt: Date }>> {
  await group.sync();
  const messages = await group.messages({ limit: BigInt(limit) });

  return messages
    .filter((m) => typeof m.content === 'string' && m.content.length > 0)
    .map((m) => ({
      senderInboxId: m.senderInboxId,
      content: m.content as string,
      sentAt: new Date(m.sentAtNs ? Number(m.sentAtNs) / 1_000_000 : Date.now()),
    }));
}
