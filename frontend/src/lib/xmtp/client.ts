'use client';

import { Client, type Signer } from '@xmtp/browser-sdk';

// Singleton XMTP client per wallet address
const clientCache = new Map<string, Client>();

/**
 * Build an XMTP-compatible signer from a wagmi wallet client.
 * The signer must be able to sign arbitrary messages (personal_sign).
 */
export function buildXmtpSigner(
  address: `0x${string}`,
  signMessage: (message: string) => Promise<string>
): Signer {
  return {
    getAddress: async () => address,
    signMessage: async (message: string | Uint8Array) => {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const sig = await signMessage(text);
      return sig as `0x${string}`;
    },
  };
}

/**
 * Get or create an XMTP client for a given wallet address.
 * Clients are cached to avoid re-initialization on every render.
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
    env: 'dev', // use 'production' on mainnet
  });

  clientCache.set(address, client);
  return client;
}

/**
 * Derive a deterministic encryption key from wallet address.
 * In production this should be a user-stored key or derived via HKDF.
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
