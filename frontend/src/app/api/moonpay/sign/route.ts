import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * MoonPay Signed URL API
 *
 * MoonPay requires widget URLs to be signed with the SECRET key server-side.
 * The signed URL is then given to the frontend to open the widget safely.
 *
 * This is the "agent skill" pattern: server generates a signed purchase intent,
 * frontend just opens the URL — secret key never leaves the server.
 *
 * Docs: https://docs.moonpay.com/moonpay/web-sdk/url-signing
 */

const MOONPAY_SECRET_KEY = process.env.MOONPAY_SECRET_KEY ?? '';
const MOONPAY_PK = process.env.NEXT_PUBLIC_MOONPAY_API_KEY ?? '';
const MOONPAY_BASE = 'https://buy-sandbox.moonpay.com'; // sandbox for test keys

/**
 * POST /api/moonpay/sign
 * Body: { walletAddress, amount?, currencyCode? }
 * Returns: { url: string } — signed MoonPay widget URL
 */
export async function POST(req: NextRequest) {
  if (!MOONPAY_SECRET_KEY) {
    return NextResponse.json({ error: 'MoonPay not configured' }, { status: 503 });
  }

  const { walletAddress, amount = 50, currencyCode = 'usdc' } = await req.json();

  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  // Build the unsigned query string
  const params = new URLSearchParams({
    apiKey: MOONPAY_PK,
    currencyCode,
    walletAddress,
    baseCurrencyCode: 'usd',
    baseCurrencyAmount: String(amount),
    redirectURL: `${req.headers.get('origin') ?? ''}/markets`,
    colorCode: '%230f172a',
    showWalletAddressForm: 'false',
  });

  const rawUrl = `${MOONPAY_BASE}?${params.toString()}`;

  // Sign with HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', MOONPAY_SECRET_KEY)
    .update(new URL(rawUrl).search)
    .digest('base64');

  const signedUrl = `${rawUrl}&signature=${encodeURIComponent(signature)}`;

  return NextResponse.json({ url: signedUrl });
}
