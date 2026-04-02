import { NextRequest, NextResponse } from 'next/server';
import { createWallet, listWallets } from '@open-wallet-standard/core';

/**
 * GET /api/ows/wallet
 * List all OWS wallets. Returns the agent treasury wallet if it exists.
 */
export async function GET() {
  try {
    const wallets = await listWallets();
    return NextResponse.json({ wallets });
  } catch (err) {
    console.error('[OWS] listWallets error:', err);
    return NextResponse.json({ error: 'Failed to list wallets' }, { status: 500 });
  }
}

/**
 * POST /api/ows/wallet
 * Create a new OWS wallet. Body: { name: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name ?? 'gnothi-agent-treasury';

    const wallet = await createWallet(name);
    return NextResponse.json({ wallet }, { status: 201 });
  } catch (err) {
    console.error('[OWS] createWallet error:', err);
    return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
  }
}
