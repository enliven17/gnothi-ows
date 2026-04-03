'use client';

import { Client, type Signer } from '@xmtp/browser-sdk';
import type { Identifier } from '@xmtp/wasm-bindings';

// Singleton XMTP client per wallet address
const clientCache = new Map<string, Client>();

/**
 * Build an XMTP-compatible EOA signer from a wagmi wallet client.
 */
export function buildXmtpSigner(
  address: `0x${string}`,
  signMessage: (message: string) => Promise<string>
): Signer {
  const identifier: Identifier = {
    identifier: address.toLowerCase(),
    identifierKind: 'Ethereum',
  };

  return {
    type: 'EOA',
    getIdentifier: () => identifier,
    signMessage: async (message: string): Promise<Uint8Array> => {
      const sig = await signMessage(message);
      const hex = sig.startsWith('0x') ? sig.slice(2) : sig;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    },
  };
}

/**
 * Get or create an XMTP client for a given wallet address.
 */
export async function getXmtpClient(
  address: `0x${string}`,
  signMessage: (message: string) => Promise<string>
): Promise<Client> {
  if (clientCache.has(address)) {
    return clientCache.get(address)!;
  }

  const signer = buildXmtpSigner(address, signMessage);
  const dbEncryptionKey = generateEncryptionKey(address);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: 'dev',
  });

  clientCache.set(address, client);
  return client;
}

/**
 * Derive a deterministic encryption key from wallet address.
 */
function generateEncryptionKey(address: string): Uint8Array {
  const encoder = new TextEncoder();
  const seed = encoder.encode(`gnothi-xmtp-${address.toLowerCase()}`);
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = seed[i % seed.length] ^ (i * 37);
  }
  return key;
}

export { Client };
