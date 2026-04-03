import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';

/**
 * OWS Credential endpoint — prediction market reputation per wallet.
 *
 * Backed by Supabase table `ows_credentials`:
 *   wallet_address TEXT PRIMARY KEY
 *   total_markets  INT DEFAULT 0
 *   correct_predictions INT DEFAULT 0
 *   accuracy_rate  FLOAT DEFAULT 0
 *   total_staked   TEXT DEFAULT '0'
 *   updated_at     TIMESTAMPTZ DEFAULT NOW()
 *
 * Falls back to zero-value stub when Supabase is not configured.
 */

interface MarketCredential {
  walletAddress: string;
  totalMarkets: number;
  correctPredictions: number;
  accuracyRate: number;
  totalStaked: string;
  issuedAt: number;
}

/**
 * GET /api/ows/credential?address=0x...
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('ows_credentials')
      .select('*')
      .eq('wallet_address', address.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('[OWS] credential GET error:', error.message);
    } else if (data) {
      const credential: MarketCredential = {
        walletAddress: data.wallet_address,
        totalMarkets: data.total_markets ?? 0,
        correctPredictions: data.correct_predictions ?? 0,
        accuracyRate: data.accuracy_rate ?? 0,
        totalStaked: data.total_staked ?? '0',
        issuedAt: new Date(data.updated_at ?? Date.now()).getTime(),
      };
      return NextResponse.json({ credential, backend: 'supabase' });
    }
  }

  // Stub (Supabase not configured or row not found yet)
  const credential: MarketCredential = {
    walletAddress: address,
    totalMarkets: 0,
    correctPredictions: 0,
    accuracyRate: 0,
    totalStaked: '0',
    issuedAt: Date.now(),
  };
  return NextResponse.json({ credential, backend: 'stub' });
}

/**
 * POST /api/ows/credential
 * Called by the bridge service after market resolution.
 * Body: { walletAddress, marketId, won: boolean, staked: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, marketId, won, staked } = body;

    if (!walletAddress || !marketId) {
      return NextResponse.json({ error: 'walletAddress and marketId are required' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (supabase) {
      // Upsert — increment counters
      const addr = walletAddress.toLowerCase();
      const { data: existing } = await supabase
        .from('ows_credentials')
        .select('*')
        .eq('wallet_address', addr)
        .maybeSingle();

      const totalMarkets = (existing?.total_markets ?? 0) + 1;
      const correctPredictions = (existing?.correct_predictions ?? 0) + (won ? 1 : 0);
      const accuracyRate = totalMarkets > 0 ? (correctPredictions / totalMarkets) * 100 : 0;
      const prevStaked = parseFloat(existing?.total_staked ?? '0');
      const totalStaked = (prevStaked + parseFloat(staked ?? '0')).toFixed(2);

      const { error } = await supabase
        .from('ows_credentials')
        .upsert({
          wallet_address: addr,
          total_markets: totalMarkets,
          correct_predictions: correctPredictions,
          accuracy_rate: accuracyRate,
          total_staked: totalStaked,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'wallet_address' });

      if (error) {
        console.error('[OWS] credential upsert error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, totalMarkets, accuracyRate: accuracyRate.toFixed(1), backend: 'supabase' });
    }

    // No Supabase — log only
    console.log('[OWS] Credential update (no-op, Supabase not configured):', { walletAddress, marketId, won, staked });
    return NextResponse.json({ success: true, backend: 'stub' });
  } catch (err) {
    console.error('[OWS] credential POST error:', err);
    return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 });
  }
}
