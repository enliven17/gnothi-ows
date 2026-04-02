'use client';

/**
 * OWS client helpers for the frontend.
 * OWS core runs server-side only; these functions call the Next.js API routes.
 */

export interface OWSWallet {
  id: string;
  name: string;
  createdAt: string;
  accounts: string[]; // CAIP-10 addresses
}

export interface MarketCredential {
  walletAddress: string;
  totalMarkets: number;
  correctPredictions: number;
  accuracyRate: number;
  totalStaked: string;
  issuedAt: number;
}

/**
 * List OWS wallets via the server API route.
 */
export async function listOWSWallets(): Promise<OWSWallet[]> {
  const res = await fetch('/api/ows/wallet');
  if (!res.ok) throw new Error('Failed to list OWS wallets');
  const data = await res.json();
  return data.wallets ?? [];
}

/**
 * Create a new OWS wallet.
 */
export async function createOWSWallet(name: string): Promise<OWSWallet> {
  const res = await fetch('/api/ows/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create OWS wallet');
  const data = await res.json();
  return data.wallet;
}

/**
 * Fetch prediction market credential for a wallet address.
 */
export async function getMarketCredential(address: string): Promise<MarketCredential | null> {
  try {
    const res = await fetch(`/api/ows/credential?address=${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.credential ?? null;
  } catch {
    return null;
  }
}

/**
 * Format accuracy rate as a human-readable string.
 */
export function formatAccuracy(rate: number): string {
  if (rate === 0) return 'No history';
  return `${rate.toFixed(1)}% accuracy`;
}
