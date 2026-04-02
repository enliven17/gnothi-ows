'use client';

/**
 * MoonPay onramp integration — agent skill pattern.
 *
 * Flow:
 *  1. Frontend calls /api/moonpay/sign (server) with wallet address + amount
 *  2. Server signs the URL with HMAC-SHA256 using the SECRET key
 *  3. Frontend opens the signed URL as a popup
 *  4. User buys USDC — funds arrive directly in their wallet
 *  5. MoonPay calls /api/moonpay/webhook on completion
 *
 * The secret key NEVER touches the browser. This satisfies MoonPay's
 * "agent skill" security requirement.
 */

export interface OnrampOptions {
  walletAddress: string;
  baseCurrencyAmount?: number;
  currencyCode?: string;
  onClose?: () => void;
  onSuccess?: (txId: string) => void;
}

/**
 * Open the MoonPay widget with a server-signed URL.
 * Falls back to unsigned URL if signing API is unavailable.
 */
export async function openMoonPayOnramp(options: OnrampOptions): Promise<void> {
  const {
    walletAddress,
    baseCurrencyAmount = 50,
    currencyCode = 'usdc',
    onClose,
    onSuccess,
  } = options;

  let widgetUrl: string;

  try {
    // Get server-signed URL
    const res = await fetch('/api/moonpay/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, amount: baseCurrencyAmount, currencyCode }),
    });

    if (!res.ok) throw new Error('Sign API failed');
    const { url } = await res.json();
    widgetUrl = url;
  } catch {
    // Fallback: unsigned URL (sandbox still works without signature)
    const pk = process.env.NEXT_PUBLIC_MOONPAY_API_KEY ?? '';
    const params = new URLSearchParams({
      apiKey: pk,
      currencyCode,
      walletAddress,
      baseCurrencyCode: 'usd',
      baseCurrencyAmount: String(baseCurrencyAmount),
    });
    widgetUrl = `https://buy-sandbox.moonpay.com?${params.toString()}`;
  }

  const popup = window.open(widgetUrl, 'moonpay-onramp', 'width=480,height=700,scrollbars=yes');

  if (!popup) {
    window.location.href = widgetUrl;
    return;
  }

  // Poll for popup close
  const interval = setInterval(() => {
    if (popup.closed) {
      clearInterval(interval);
      onClose?.();
    }
  }, 500);

  // Listen for MoonPay postMessage completion event
  const handleMessage = (event: MessageEvent) => {
    if (!String(event.origin).includes('moonpay.com')) return;
    if (event.data?.type === 'moonpay:transaction:completed') {
      onSuccess?.(event.data.transactionId ?? '');
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    }
  };
  window.addEventListener('message', handleMessage);
}

export function isMoonPayConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_MOONPAY_API_KEY ?? '').length > 0;
}
