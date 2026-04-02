# AI Console

## Overview

The **AI Console** is a transparency feature that allows users to watch GenLayer validators resolve markets in real-time. Unlike traditional prediction markets where resolution is a black box, Gnothi exposes:

- Which URLs validators are scraping
- Individual agent decisions
- Consensus formation progress
- Final resolution details

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI CONSOLE DATA FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Market Status   │
│  = 'RESOLVING'   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: useAIConsole Hook                                                 │
│  ──────────────────────────────────────────────────────────────────────────  │
│  useEffect(() => {                                                           │
│    // Step 1: Fetch GenLayer tx hash from bridge service                     │
│    const { txHash } = await fetch(`/api/oracle/tx/${marketId}`);             │
│                                                                              │
│    // Step 2: Poll GenLayer for transaction status                           │
│    const tx = await genlayer.getTransactionByHash(txHash);                   │
│                                                                              │
│    // Step 3: Extract validator information                                  │
│    setValidators(tx.validators);                                             │
│    setConsensus(tx.consensus);                                               │
│    setStatus(tx.status);                                                     │
│  }, 2000);  // Poll every 2 seconds                                          │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         │ Poll every 2 seconds
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  BRIDGE SERVICE: /api/oracle/tx/:contractAddress                             │
│  ──────────────────────────────────────────────────────────────────────────  │
│  // In-memory or Supabase storage                                            │
│  const oracleDeployment = oracleDeployments.get(contractAddress);            │
│                                                                              │
│  res.json({                                                                  │
│    txHash: oracleDeployment.txHash,                                          │
│    oracleAddress: oracleDeployment.oracleAddress,                            │
│    deployedAt: oracleDeployment.deployedAt                                   │
│  });                                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         │ Returns tx hash
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER RPC: getTransactionByHash(txHash)                                  │
│  ──────────────────────────────────────────────────────────────────────────  │
│  // GenLayer transaction includes validator details                          │
│  {                                                                           │
│    hash: "0x...",                                                            │
│    status: "PENDING" | "ACCEPTED" | "FINALIZED",                             │
│    contract_address: "0x...",                                                │
│    validators: [                                                             │
│      {                                                                       │
│        id: 1,                                                                │
│        stake: "1000000",                                                     │
│        output: "{\"decision\": \"SIDE_A\"}",                                 │
│        status: "ACCEPTED"                                                    │
│      },                                                                      │
│      ...                                                                     │
│    ],                                                                        │
│    consensus: "SIDE_A",                                                      │
│    created_at: "2025-12-31T14:30:00Z"                                        │
│  }                                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

### AIConsole.tsx

```typescript
// frontend/src/app/components/AIConsole/AIConsole.tsx

import React from 'react';
import { useAIConsole } from '../../hooks/useAIConsole';
import styles from './AIConsole.module.css';

interface AIConsoleProps {
  marketId: string;
  status: 'ACTIVE' | 'RESOLVING' | 'RESOLVED' | 'UNDETERMINED';
}

interface Validator {
  id: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  decision?: 'SIDE_A' | 'SIDE_B' | 'UNDECIDED';
  stake?: string;
  output?: string;
}

export function AIConsole({ marketId, status }: AIConsoleProps) {
  const { txHash, validators, consensus, loading, error } = useAIConsole(
    marketId,
    status
  );

  // Don't show for active markets
  if (status === 'ACTIVE') {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className={styles.console}>
        <h3>AI Oracle Resolution</h3>
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <p>Failed to load oracle status</p>
          <small>{error}</small>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || !txHash) {
    return (
      <div className={styles.console}>
        <h3>AI Oracle Resolution</h3>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Waiting for oracle deployment...</p>
        </div>
      </div>
    );
  }

  // Show resolved state
  if (status === 'RESOLVED' || status === 'UNDETERMINED') {
    return (
      <div className={styles.console}>
        <h3>AI Oracle Resolution</h3>
        
        <div className={styles.resultBanner}>
          <span className={styles.resultIcon}>
            {status === 'RESOLVED' ? '✅' : '⏳'}
          </span>
          <span className={styles.resultText}>
            {status === 'RESOLVED' 
              ? `Consensus: ${consensus}`
              : 'Undetermined (no consensus)'}
          </span>
        </div>

        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.label}>Decision:</span>
            <span className={styles.value}>{consensus || 'N/A'}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.label}>Validators:</span>
            <span className={styles.value}>{validators?.length || 0}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.label}>Tx Hash:</span>
            <a 
              href={`https://explorer.genlayer.net/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show resolving state (live updates)
  return (
    <div className={styles.console}>
      <h3>AI Oracle Resolution - Live</h3>
      
      <div className={styles.validatorGrid}>
        {validators?.map((validator, i) => (
          <ValidatorCard 
            key={validator.id || i} 
            validator={validator}
            index={i}
          />
        ))}
      </div>

      {consensus && (
        <div className={styles.consensusBanner}>
          <span className={styles.consensusIcon}>✅</span>
          <span>
            Consensus: <strong>{consensus}</strong>
            {' '}{validators?.length}/5 validators agreed
          </span>
        </div>
      )}

      {!consensus && (
        <div className={styles.waitingBanner}>
          <span className={styles.spinnerSmall}></span>
          <span>Waiting for consensus...</span>
        </div>
      )}
    </div>
  );
}
```

---

### ValidatorCard Sub-Component

```typescript
// frontend/src/app/components/AIConsole/ValidatorCard.tsx

import React from 'react';
import styles from './AIConsole.module.css';

interface ValidatorCardProps {
  validator: {
    id: number;
    status: string;
    decision?: string;
    output?: string;
  };
  index: number;
}

export function ValidatorCard({ validator, index }: ValidatorCardProps) {
  const getStatusIcon = () => {
    switch (validator.status) {
      case 'ACCEPTED':
        return '✓';
      case 'REJECTED':
        return '✗';
      default:
        return '⏳';
    }
  };

  const getStatusColor = () => {
    switch (validator.status) {
      case 'ACCEPTED':
        return styles.statusAccepted;
      case 'REJECTED':
        return styles.statusRejected;
      default:
        return styles.statusPending;
    }
  };

  const getDecisionColor = () => {
    switch (validator.decision) {
      case 'SIDE_A':
        return styles.decisionA;
      case 'SIDE_B':
        return styles.decisionB;
      case 'UNDECIDED':
        return styles.decisionUndecided;
      default:
        return '';
    }
  };

  return (
    <div className={styles.validatorCard}>
      <div className={styles.cardHeader}>
        <span className={styles.validatorName}>Agent {index + 1}</span>
        <span className={`${styles.validatorStatus} ${getStatusColor()}`}>
          {getStatusIcon()}
        </span>
      </div>

      <div className={styles.cardBody}>
        {validator.decision ? (
          <div className={`${styles.decision} ${getDecisionColor()}`}>
            {validator.decision.replace('_', ' ')}
          </div>
        ) : (
          <div className={styles.scanning}>
            <span className={styles.spinnerSmall}></span>
            Scanning evidence...
          </div>
        )}
      </div>

      {validator.output && (
        <div className={styles.rawOutput}>
          <details>
            <summary>Raw Output</summary>
            <pre>{validator.output}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
```

---

## Hook Implementation

### useAIConsole.ts

```typescript
// frontend/src/app/hooks/useAIConsole.ts

import { useState, useEffect } from 'react';
import { createClient } from 'genlayer-js';
import { bradbury } from 'genlayer-js/chains';

interface Validator {
  id: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  decision?: 'SIDE_A' | 'SIDE_B' | 'UNDECIDED';
  stake?: string;
  output?: string;
}

interface UseAIConsoleReturn {
  txHash: string | null;
  validators: Validator[];
  consensus: string | null;
  loading: boolean;
  error: string | null;
}

export function useAIConsole(
  marketId: string,
  status: string
): UseAIConsoleReturn {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [consensus, setConsensus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // GenLayer client
  const genlayerClient = createClient({
    chain: {
      ...bradbury,
      rpcUrls: {
        default: { http: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL!] },
      },
    },
  });

  useEffect(() => {
    // Only poll for RESOLVING markets
    if (status !== 'RESOLVING') {
      setLoading(false);
      return;
    }

    let pollInterval: NodeJS.Timeout;
    let isMounted = true;

    const pollOracle = async () => {
      try {
        // Step 1: Fetch tx hash from bridge service
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BRIDGE_SERVICE_URL}/oracle/tx/${marketId}`
        );
        
        if (!response.ok) {
          throw new Error('Oracle deployment not found');
        }

        const data = await response.json();
        
        if (!data.txHash) {
          throw new Error('No transaction hash found');
        }

        setTxHash(data.txHash);

        // Step 2: Fetch transaction status from GenLayer
        const tx = await genlayerClient.getTransactionByHash(data.txHash);

        if (isMounted) {
          if (tx && tx.data) {
            // Extract validator information
            const validatorList = tx.data.validators?.map((v: any) => ({
              id: v.id,
              status: v.status,
              decision: extractDecision(v.output),
              output: v.output,
            })) || [];

            setValidators(validatorList);
            setConsensus(tx.data.consensus || null);

            // Stop polling if finalized
            if (tx.status === 'FINALIZED') {
              setLoading(false);
              if (pollInterval) {
                clearInterval(pollInterval);
              }
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    pollOracle();

    // Poll every 2 seconds
    pollInterval = setInterval(pollOracle, 2000);

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [marketId, status]);

  return { txHash, validators, consensus, loading, error };
}

// Helper: Extract decision from validator output
function extractDecision(output?: string): 'SIDE_A' | 'SIDE_B' | 'UNDECIDED' | undefined {
  if (!output) return undefined;

  try {
    // Remove markdown code blocks
    const clean = output.replace(/```(?:json)?\s*|\s*```/g, '').trim();
    const data = JSON.parse(clean);
    const decision = data.decision?.toUpperCase();

    if (['SIDE_A', 'SIDE_B', 'UNDECIDED'].includes(decision)) {
      return decision as 'SIDE_A' | 'SIDE_B' | 'UNDECIDED';
    }
  } catch {
    // Parse failed
  }

  return undefined;
}
```

---

## CSS Styling

### AIConsole.module.css

```css
/* frontend/src/app/components/AIConsole/AIConsole.module.css */

.console {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid #0f3460;
  border-radius: 12px;
  padding: 24px;
  margin-top: 24px;
  color: #e8e8e8;
  font-family: 'JetBrains Mono', monospace;
}

.console h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Validator Grid */
.validatorGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.validatorCard {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
}

.validatorCard:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.validatorName {
  font-size: 14px;
  font-weight: 600;
  color: #a0a0a0;
}

.validatorStatus {
  font-size: 16px;
  font-weight: bold;
}

.statusAccepted {
  color: #4ade80;
}

.statusRejected {
  color: #f87171;
}

.statusPending {
  color: #fbbf24;
}

.cardBody {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.decision {
  font-size: 16px;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 6px;
  width: 100%;
  text-align: center;
}

.decisionA {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.decisionB {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.decisionUndecided {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.scanning {
  color: #a0a0a0;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Consensus Banner */
.consensusBanner,
.waitingBanner,
.resultBanner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
}

.consensusBanner {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
}

.waitingBanner {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.resultBanner {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
  margin-bottom: 16px;
}

/* Details Section */
.details {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.detailRow {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detailRow:last-child {
  border-bottom: none;
}

.label {
  color: #a0a0a0;
  font-size: 14px;
}

.value {
  color: #e8e8e8;
  font-size: 14px;
  font-weight: 500;
}

.link {
  color: #60a5fa;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

/* Error State */
.error {
  text-align: center;
  padding: 20px;
  color: #f87171;
}

.errorIcon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.error p {
  margin: 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.error small {
  color: #a0a0a0;
  font-size: 12px;
}

/* Loading State */
.loading {
  text-align: center;
  padding: 40px 20px;
  color: #a0a0a0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.spinnerSmall {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #fbbf24;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Raw Output */
.rawOutput {
  margin-top: 12px;
  font-size: 11px;
}

.rawOutput details {
  color: #a0a0a0;
}

.rawOutput summary {
  cursor: pointer;
  padding: 4px 0;
}

.rawOutput pre {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 8px;
  margin-top: 8px;
  overflow-x: auto;
  font-size: 10px;
  line-height: 1.4;
}
```

---

## Bridge Service API

### Oracle Registry

```typescript
// bridge/service/src/resolution/OracleRegistry.ts

import { createClient } from '@supabase/supabase-js';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// In-memory fallback
const oracleDeployments = new Map<string, {
  txHash: string;
  oracleAddress: string;
  deployedAt: number;
}>();

export async function recordOracle(
  contractAddress: string,
  txHash: string,
  oracleAddress: string
): Promise<void> {
  if (supabase) {
    // Persistent storage
    await supabase
      .from('oracle_deployments')
      .insert({
        contract_address: contractAddress,
        tx_hash: txHash,
        oracle_address: oracleAddress,
        deployed_at: new Date().toISOString(),
      });
  } else {
    // In-memory fallback
    oracleDeployments.set(contractAddress, {
      txHash,
      oracleAddress,
      deployedAt: Date.now(),
    });
  }

  console.log(`[OracleRegistry] Recorded oracle for ${contractAddress}`);
}

export async function getOracleTx(
  contractAddress: string
): Promise<{ txHash: string; oracleAddress: string } | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('oracle_deployments')
      .select('tx_hash, oracle_address')
      .eq('contract_address', contractAddress)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      txHash: data.tx_hash,
      oracleAddress: data.oracle_address,
    };
  } else {
    const deployment = oracleDeployments.get(contractAddress);
    return deployment
      ? { txHash: deployment.txHash, oracleAddress: deployment.oracleAddress }
      : null;
  }
}
```

---

### HTTP Endpoint

```typescript
// bridge/service/src/api.ts

import express from 'express';
import { getOracleTx } from './resolution/OracleRegistry.js';

const app = express();

// GET /oracle/tx/:contractAddress
app.get('/oracle/tx/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    const oracle = await getOracleTx(contractAddress);
    
    if (!oracle) {
      return res.status(404).json({
        error: 'Oracle deployment not found',
      });
    }

    res.json({
      txHash: oracle.txHash,
      oracleAddress: oracle.oracleAddress,
    });
  } catch (error) {
    console.error('Error fetching oracle tx:', error);
    res.status(500).json({
      error: 'Failed to fetch oracle data',
    });
  }
});

export default app;
```

---

## Usage Examples

### Market Detail Page

```typescript
// frontend/src/app/markets/[id]/page.tsx

'use client';

import { AIConsole } from '../../components/AIConsole/AIConsole';
import { useMarket } from '../../hooks/useMarket';

export default function MarketDetail({ params }: { params: { id: string } }) {
  const { market, status } = useMarket(params.id);

  return (
    <div className="market-detail">
      <h1>{market.title}</h1>
      
      {/* Market info, betting UI, etc. */}
      
      {/* AI Console for RESOLVING/RESOLVED markets */}
      {status === 'RESOLVING' || status === 'RESOLVED' || status === 'UNDETERMINED' ? (
        <AIConsole marketId={params.id} status={status} />
      ) : null}
    </div>
  );
}
```

### Full-Page Market View

```typescript
// frontend/src/app/markets/[id]/full/page.tsx

import { AIConsole } from '../../../components/AIConsole/AIConsole';

export default function FullMarketView({ params }: { params: { id: string } }) {
  return (
    <div className="full-market-view">
      <MarketHeader marketId={params.id} />
      <MarketChart marketId={params.id} />
      <BettingPanel marketId={params.id} />
      
      {/* AI Console always visible in full view */}
      <AIConsole marketId={params.id} status={marketStatus} />
    </div>
  );
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Oracle deployment not found"

**Cause**: Bridge service hasn't recorded the deployment yet.

**Solution**: Wait 5-10 seconds after resolution is triggered.

---

#### 2. "Failed to fetch transaction"

**Cause**: GenLayer RPC endpoint unreachable.

**Solution**: Check `NEXT_PUBLIC_GENLAYER_RPC_URL` environment variable.

---

#### 3. Validators show "Scanning..." indefinitely

**Cause**: GenLayer consensus taking longer than expected.

**Solution**: Normal behavior. Consensus can take 2-5 minutes.

---

#### 4. Empty validator list

**Cause**: Transaction not yet picked up by validators.

**Solution**: Wait for next block. Polling continues automatically.

---

## Next Steps

- [Deployment Guide](./07-deployment.md) - Deploy your own instance
- [API Reference](./08-api.md) - Complete bridge service API documentation
- [Troubleshooting](./09-troubleshooting.md) - Common issues and solutions
