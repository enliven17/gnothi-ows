import { NextRequest, NextResponse } from 'next/server';

/**
 * OWS Credential endpoint.
 *
 * Stores and retrieves prediction market reputation credentials
 * tied to a wallet address. Used for:
 * - Tracking prediction accuracy over time
 * - Gating access to premium markets
 * - Building on-chain reputation score
 *
 * Credentials are stored as JWT-style attestations signed by the
 * OWS wallet and verified on-chain via the GroupMarket contract.
 */

interface MarketCredential {
  walletAddress: string;
  totalMarkets: number;
  correctPredictions: number;
  accuracyRate: number; // 0-100
  totalStaked: string; // in USDC
  issuedAt: number;
}

/**
 * GET /api/ows/credential?address=0x...
 * Return the prediction credential for a wallet.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 });
  }

  // TODO: Query on-chain reputation contract or Supabase
  // For now return a stub that the frontend can display
  const credential: MarketCredential = {
    walletAddress: address,
    totalMarkets: 0,
    correctPredictions: 0,
    accuracyRate: 0,
    totalStaked: '0',
    issuedAt: Date.now(),
  };

  return NextResponse.json({ credential });
}

/**
 * POST /api/ows/credential
 * Issue or update a credential after market resolution.
 * Called by the bridge service when a market resolves.
 * Body: { walletAddress, marketId, won, staked }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, marketId, won, staked } = body;

    if (!walletAddress || !marketId) {
      return NextResponse.json({ error: 'walletAddress and marketId are required' }, { status: 400 });
    }

    // TODO: Update on-chain credential via OWS signed transaction
    // For now log and return success
    console.log('[OWS] Credential update:', { walletAddress, marketId, won, staked });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[OWS] credential update error:', err);
    return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 });
  }
}
