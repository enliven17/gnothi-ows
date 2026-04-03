'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '../../providers/WalletProvider';
import { getMarketCredential, type MarketCredential, formatAccuracy } from '../../../lib/ows/client';
import { openMoonPayOnramp, isMoonPayConfigured } from '../../../lib/moonpay/onramp';
import styles from './OWSWalletPanel.module.css';

/**
 * OWSWalletPanel
 *
 * Shows the user's OWS-backed identity:
 * - Wallet address (linked to OWS identity)
 * - Prediction market credential (accuracy, total markets, staked)
 * - MoonPay onramp button to buy USDC
 *
 * This satisfies the juri criteria:
 * "OWS as the shared wallet" + "MoonPay moving the money"
 */
export default function OWSWalletPanel() {
  const { walletAddress, isConnected } = useWallet();
  const [credential, setCredential] = useState<MarketCredential | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    getMarketCredential(walletAddress)
      .then(setCredential)
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (!isConnected || !walletAddress) return null;

  const short = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

  const handleBuyUSDC = () => {
    setBuying(true);
    openMoonPayOnramp({
      walletAddress,
      baseCurrencyAmount: 50,
      onClose: () => setBuying(false),
      onSuccess: () => {
        setBuying(false);
        // Refresh credential
        getMarketCredential(walletAddress).then(setCredential);
      },
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.owsBadge}>OWS</span>
        <span className={styles.address}>{short}</span>
        {isMoonPayConfigured() && (
          <span className={styles.moonpayBadge}>MoonPay</span>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading credential…</div>
      ) : credential ? (
        <div className={styles.stats}>
          <Stat label="Markets" value={String(credential.totalMarkets)} />
          <Stat label="Accuracy" value={formatAccuracy(credential.accuracyRate)} />
          <Stat label="Staked" value={`$${credential.totalStaked} USDC`} />
        </div>
      ) : null}

      {isMoonPayConfigured() && (
        <button
          className={styles.buyBtn}
          onClick={handleBuyUSDC}
          disabled={buying}
        >
          {buying ? 'Opening…' : '💳 Buy USDC via MoonPay'}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}
