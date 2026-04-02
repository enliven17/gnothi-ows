import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * MoonPay Webhook Handler
 *
 * Receives payment completion events from MoonPay.
 * On successful USDC purchase: confirms to the user that funds arrived.
 *
 * Register this URL in MoonPay Dashboard → Webhooks:
 *   https://your-domain.com/api/moonpay/webhook
 */

const MOONPAY_WEBHOOK_KEY = process.env.MOONPAY_WEBHOOK_KEY ?? '';

function verifyWebhookSignature(body: string, sigHeader: string): boolean {
  if (!MOONPAY_WEBHOOK_KEY) return false;
  const expected = crypto
    .createHmac('sha256', MOONPAY_WEBHOOK_KEY)
    .update(body)
    .digest('hex');
  return `sha256=${expected}` === sigHeader;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('moonpay-signature') ?? '';

  if (MOONPAY_WEBHOOK_KEY && !verifyWebhookSignature(body, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[MoonPay Webhook]', event.type, event.data?.status);

  // Handle successful transaction
  if (event.type === 'transaction_updated' && event.data?.status === 'completed') {
    const { walletAddress, cryptoTransactionId, baseCurrencyAmount, quoteCurrencyAmount } = event.data;
    console.log(`[MoonPay] ✅ Payment completed: ${baseCurrencyAmount} USD → ${quoteCurrencyAmount} USDC → ${walletAddress}`);
    console.log(`[MoonPay] TX: ${cryptoTransactionId}`);

    // TODO: Trigger notification to user via XMTP or Supabase realtime
    // notifyUser(walletAddress, `${quoteCurrencyAmount} USDC received — ready to bet!`)
  }

  return NextResponse.json({ received: true });
}
