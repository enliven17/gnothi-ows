import { NextRequest, NextResponse } from 'next/server';

/**
 * OWS Wallet API — simple key-value store implementation.
 * @open-wallet-standard/core requires unavailable native bindings on this platform,
 * so we implement the same interface manually.
 */

interface OWSWallet {
  id: string;
  name: string;
  address: string;
  createdAt: number;
}

// In-memory store (replace with Supabase/DB for production)
const walletStore = new Map<string, OWSWallet>();

// Pre-seed the agent treasury wallet so the UI shows something immediately
walletStore.set('gnothi-agent-treasury', {
  id: 'gnothi-agent-treasury',
  name: 'gnothi-agent-treasury',
  address: process.env.NEXT_PUBLIC_OWNER_ADDRESS ?? '0x0000000000000000000000000000000000000000',
  createdAt: Date.now(),
});

/**
 * GET /api/ows/wallet
 * List all OWS wallets.
 */
export async function GET() {
  const wallets = Array.from(walletStore.values());
  return NextResponse.json({ wallets });
}

/**
 * POST /api/ows/wallet
 * Create a new OWS wallet. Body: { name: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name: string = body.name ?? 'gnothi-agent-treasury';

    if (walletStore.has(name)) {
      return NextResponse.json({ wallet: walletStore.get(name) }, { status: 200 });
    }

    const wallet: OWSWallet = {
      id: name,
      name,
      address: process.env.NEXT_PUBLIC_OWNER_ADDRESS ?? '0x0000000000000000000000000000000000000000',
      createdAt: Date.now(),
    };

    walletStore.set(name, wallet);
    return NextResponse.json({ wallet }, { status: 201 });
  } catch (err) {
    console.error('[OWS] createWallet error:', err);
    return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
  }
}
