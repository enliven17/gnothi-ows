'use client';

/**
 * MoonPay onramp integration.
 *
 * Opens the MoonPay widget so users can buy USDC with fiat (card, bank transfer).
 * After purchase, the USDC lands directly in the user's wallet and can be
 * used immediately for prediction market bets.
 *
 * Docs: https://docs.moonpay.com/moonpay/web-sdk
 */

const MOONPAY_BASE_URL = 'https://buy.moonpay.com';
const MOONPAY_API_KEY = process.env.NEXT_PUBLIC_MOONPAY_API_KEY ?? '';

export interface OnrampOptions {
  /** Destination wallet address (receives the purchased USDC) */
  walletAddress: string;
  /** Pre-fill amount in USD */
  baseCurrencyAmount?: number;
  /** Callback when widget closes */
  onClose?: () => void;
  /** Callback when transaction completes */
  onSuccess?: (txHash: string) => void;
}

/**
 * Open the MoonPay onramp widget in a popup window.
 * Targets USDC on Base Sepolia (testnet) or Base Mainnet.
 */
export function openMoonPayOnramp(options: OnrampOptions): void {
  const { walletAddress, baseCurrencyAmount = 50, onClose, onSuccess } = options;

  const params = new URLSearchParams({
    apiKey: MOONPAY_API_KEY,
    currencyCode: 'usdc_base',        // USDC on Base
    walletAddress,
    baseCurrencyCode: 'usd',
    baseCurrencyAmount: baseCurrencyAmount.toString(),
    colorCode: '%230f172a',           // match app accent color
    showWalletAddressForm: 'false',   // address is pre-filled
  });

  const url = `${MOONPAY_BASE_URL}?${params.toString()}`;

  const popup = window.open(
    url,
    'moonpay-onramp',
    'width=480,height=700,scrollbars=yes,resizable=yes'
  );

  if (!popup) {
    // Fallback: open in same tab if popup was blocked
    window.location.href = url;
    return;
  }

  // Poll for completion or close
  const interval = setInterval(() => {
    if (popup.closed) {
      clearInterval(interval);
      onClose?.();
    }
  }, 500);

  // Listen for postMessage from MoonPay widget
  const handleMessage = (event: MessageEvent) => {
    if (!event.origin.includes('moonpay.com')) return;
    if (event.data?.type === 'moonpay:transaction:completed') {
      onSuccess?.(event.data.transactionId ?? '');
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    }
  };
  window.addEventListener('message', handleMessage);
}

/**
 * Check if MoonPay is configured (API key present).
 */
export function isMoonPayConfigured(): boolean {
  return MOONPAY_API_KEY.length > 0;
}
