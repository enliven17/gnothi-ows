# SCEM Payout Mechanism

## Overview

Gnothi uses **Strictly Proper Scoring Rules (SCEM)** to distribute payouts in prediction markets. Unlike traditional "winner-takes-all" betting, SCEM rewards:

1. **Accuracy**: Being on the correct side
2. **Confidence calibration**: Higher rewards for confident correct predictions
3. **Early participation**: Better prices before market moves

---

## Mathematical Foundation

### Quadratic Scoring Rule

Gnothi implements a **simplified SCEM** using the quadratic scoring rule:

```
S(r, q) = 2qr - q²
```

**Where**:
- `S` = Score
- `r` = Realized outcome (100 if correct, 0 if wrong)
- `q` = Predicted probability (1-99)

### Properties

| Property | Description |
|----------|-------------|
| **Strictly Proper** | Maximum expected reward when reporting true belief |
| **Bounded** | Score range: [-9801, 10000] (scaled by 100) |
| **Symmetric** | Same formula for both sides |

---

## Score Calculation

### For Winners (r = 100)

```
S(100, q) = 2q(100) - q² = 200q - q²
```

| Confidence (q) | Score S(100, q) | Relative Weight |
|----------------|-----------------|-----------------|
| 1% | 200 - 1 = **199** | 2.0% |
| 25% | 5000 - 625 = **4375** | 43.8% |
| 50% | 10000 - 2500 = **7500** | 75.0% |
| 75% | 15000 - 5625 = **9375** | 93.8% |
| 99% | 19800 - 9801 = **9999** | 100% |

### For Losers (r = 0)

```
S(0, q) = 2q(0) - q² = -q²
```

| Confidence (q) | Score S(0, q) |
|----------------|---------------|
| 1% | **-1** |
| 25% | **-625** |
| 50% | **-2500** |
| 75% | **-5625** |
| 99% | **-9801** |

**Note**: Losers don't receive payouts (negative score), but their bond is used to fund the winners' pool.

---

## Payout Algorithm

### Step-by-Step Process

```solidity
function _applyScemPayout() internal {
    bool _sideAWins = isSideAWinner;
    
    uint256 losersPool = 0;
    int256 totalWeightedScore = 0;
    bool anyWinners = false;
    
    // ========== PASS 1: Collect losers' bonds ==========
    for (uint256 i = 0; i < trades.length; i++) {
        TradeSnapshot memory t = trades[i];
        bool isWinner = (t.onSideA == _sideAWins);
        
        if (!isWinner) {
            // Loser's bond goes to the pool
            losersPool += t.bondAmount;
        } else {
            anyWinners = true;
            
            // Calculate winner's score: S(100, q)
            // r = 100 because winner predicted correctly
            int256 s = SCEMScoring.computeScore(t.probability, 100);
            
            // Accumulate weighted score: S × bond
            totalWeightedScore += s * int256(t.bondAmount);
        }
    }
    
    // Edge case: No one on winning side
    if (!anyWinners) {
        // Refund everyone
        for (uint256 i = 0; i < trades.length; i++) {
            scemPayout[trades[i].trader] += trades[i].bondAmount;
        }
        return;
    }
    
    // ========== PASS 2: Distribute payouts ==========
    for (uint256 i = 0; i < trades.length; i++) {
        TradeSnapshot memory t = trades[i];
        bool isWinner = (t.onSideA == _sideAWins);
        
        if (!isWinner) {
            // Losers get nothing (already contributed to pool)
            continue;
        }
        
        // Base: return original bond
        uint256 payout = t.bondAmount;
        
        // Bonus: share of losers' pool weighted by score
        if (totalWeightedScore > 0) {
            int256 s = SCEMScoring.computeScore(t.probability, 100);
            if (s > 0) {
                // Formula: (losersPool × S × bond) / totalWeightedScore
                uint256 share = (losersPool * uint256(s) * t.bondAmount) 
                                / uint256(totalWeightedScore);
                payout += share;
            }
        }
        
        scemPayout[t.trader] += payout;
    }
}
```

---

## Worked Example

### Market Setup

**Question**: "Will the FDA approve Drug X by December 2025?"

**Result**: SIDE_A wins (FDA approved)

### Trades

| Trader | Side | Bond (USDC) | Confidence | Score S(100, q) |
|--------|------|-------------|------------|-----------------|
| Alice | A ✓ | 100 | 75% | 9375 |
| Bob | A ✓ | 50 | 60% | 8400 |
| Carol | B ✗ | 80 | 80% | -6400 |
| Dave | B ✗ | 30 | 50% | -2500 |

### Calculation

#### Pass 1: Losers Pool

```
losersPool = Carol.bond + Dave.bond
           = 80 + 30
           = 110 USDC
```

#### Pass 1: Weighted Scores

```
Alice: S(100, 75) × 100 = 9375 × 100 = 937,500
Bob:   S(100, 60) × 50  = 8400 × 50  = 420,000

totalWeightedScore = 937,500 + 420,000 = 1,357,500
```

#### Pass 2: Payout Distribution

**Alice's Share**:
```
share = (losersPool × S × bond) / totalWeightedScore
      = (110 × 9375 × 100) / 1,357,500
      = 103,125,000 / 1,357,500
      = 75.93 USDC

payout = bond + share
       = 100 + 75.93
       = 175.93 USDC
```

**Bob's Share**:
```
share = (110 × 8400 × 50) / 1,357,500
      = 46,200,000 / 1,357,500
      = 34.07 USDC

payout = 50 + 34.07 = 84.07 USDC
```

### Final Distribution

| Trader | Result | Bond In | Payout Out | Profit/Loss |
|--------|--------|---------|------------|-------------|
| Alice | Winner | 100 USDC | 175.93 USDC | **+75.93** |
| Bob | Winner | 50 USDC | 84.07 USDC | **+34.07** |
| Carol | Loser | 80 USDC | 0 USDC | **-80** |
| Dave | Loser | 30 USDC | 0 USDC | **-30** |

**Check**: 175.93 + 84.07 = 260 = 100 + 50 + 80 + 30 ✓

---

## Edge Cases

### Case 1: No Winners on Winning Side

```solidity
// Scenario: Everyone bet on Side B, but Side A wins
if (!anyWinners) {
    // Refund all traders
    for (uint256 i = 0; i < trades.length; i++) {
        scemPayout[trades[i].trader] += trades[i].bondAmount;
    }
    return;
}
```

**Rationale**: No one correctly predicted the outcome, so no one deserves the losers' pool.

---

### Case 2: UNDETERMINED Result

```solidity
if (status == BetStatus.UNDETERMINED) {
    payout = betsOnSideA[user] + betsOnSideB[user];
    // Full refund, no SCEM calculation
}
```

**When**: AI consensus fails or evidence is insufficient.

---

### Case 3: Single Winner

```
Trader | Side | Bond | Score
-------|------|------|------
Alice  | A ✓  | 100  | 9375
Bob    | B ✗  | 50   | -2500

losersPool = 50
totalWeightedScore = 9375 × 100 = 937,500

Alice share = (50 × 9375 × 100) / 937,500 = 50
Alice payout = 100 + 50 = 150 USDC
```

**Result**: Single winner takes entire losers' pool.

---

## Client-Side Preview (TypeScript)

### SCEM Library

```typescript
// frontend/src/lib/scem.ts

/**
 * Compute SCEM score using quadratic scoring rule
 * S(r, q) = 2qr - q²
 * 
 * @param predictedProbability - User's predicted probability (1-99)
 * @param realizedOutcome - Actual outcome (0 or 100)
 * @returns Score (can be negative for wrong predictions)
 */
export function computeScore(
  predictedProbability: number,
  realizedOutcome: number
): number {
  const q = predictedProbability;
  const r = realizedOutcome;
  return 2 * q * r - q * q;
}

/**
 * Calculate potential payout for a winning position
 * 
 * @param bond - User's bond amount
 * @param probability - User's confidence (1-99)
 * @param losersPool - Total bonds from losing side
 * @param winningTrades - All trades on winning side
 * @returns Total payout (bond + share of losers' pool)
 */
export function calculatePayout(
  bond: number,
  probability: number,
  losersPool: number,
  winningTrades: Array<{ bond: number; probability: number }>
): number {
  // Calculate user's score
  const userScore = computeScore(probability, 100);
  
  // Calculate total weighted score
  const totalWeightedScore = winningTrades.reduce((sum, trade) => {
    const score = computeScore(trade.probability, 100);
    return sum + score * trade.bond;
  }, 0);
  
  // Calculate share of losers' pool
  const share = (losersPool * userScore * bond) / totalWeightedScore;
  
  // Return bond + share
  return bond + share;
}

/**
 * Preview payout before resolution
 */
export function previewPayout(
  userBond: number,
  userProbability: number,
  userOnSideA: boolean,
  totalSideA: number,
  totalSideB: number,
  trades: Array<{ onSideA: boolean; bond: number; probability: number }>
): { ifSideAWins: number; ifSideBWins: number } {
  const winningTrades = trades.filter(t => 
    userOnSideA ? t.onSideA : !t.onSideA
  );
  const losingTrades = trades.filter(t => 
    userOnSideA ? !t.onSideA : t.onSideA
  );
  
  const losersPool = losingTrades.reduce((sum, t) => sum + t.bond, 0);
  
  const ifSideAWins = userOnSideA
    ? calculatePayout(userBond, userProbability, losersPool, winningTrades)
    : 0;
  
  const ifSideBWins = !userOnSideA
    ? calculatePayout(userBond, userProbability, losersPool, winningTrades)
    : 0;
  
  return { ifSideAWins, ifSideBWins };
}
```

### Usage in Frontend

```typescript
// MarketDetailPanel.tsx
const { ifSideAWins, ifSideBWins } = previewPayout(
  userBond,
  userProbability,
  userOnSideA,
  totalSideA,
  totalSideB,
  allTrades
);

// Display in UI
<div className="payout-preview">
  <div>If Side A wins: {ifSideAWins.toFixed(2)} USDC</div>
  <div>If Side B wins: {ifSideBWins.toFixed(2)} USDC</div>
</div>
```

---

## Comparison with Traditional Betting

| Aspect | Traditional Betting | Gnothi SCEM |
|--------|--------------------|-------------|
| **Payout Model** | Fixed odds or pari-mutuel | Score-weighted |
| **Winner Distribution** | Split equally or by stake | Weighted by confidence |
| **Incentive** | Maximize stake | Report true belief |
| **Early vs Late** | Same odds | Better score early |
| **Confidence Penalty** | None | Overconfidence penalized |

### Example: Overconfidence Penalty

```
Scenario: Side A wins

Trader A: 99% confidence, wrong → Score: -9801
Trader B: 51% confidence, wrong → Score: -2601

Trader A loses 3.77× more than Trader B
→ Overconfidence is penalized
```

---

## Game-Theoretic Properties

### Truthful Reporting is Optimal

**Theorem**: Under SCEM, a risk-neutral agent maximizes expected reward by reporting their true belief.

**Proof Sketch**:

```
Expected Score = p × S(100, q) + (1-p) × S(0, q)
               = p × (2q - q²) + (1-p) × (-q²)
               = 2pq - q²

Taking derivative with respect to q:
d/dq = 2p - 2q

Setting to zero for maximum:
2p - 2q = 0  →  q = p

Second derivative: -2 < 0 → Maximum confirmed
```

**Conclusion**: Report `q = p` (true belief) for maximum expected score.

---

## Implementation Details

### Solidity Library

```solidity
// contracts/contracts/SCEMScoring.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

library SCEMScoring {
    /// @notice Compute quadratic scoring rule: S(r, q) = 2qr - q²
    /// @param predictedProbability Probability prediction (1-99)
    /// @param realizedOutcome Actual outcome (0 or 100)
    /// @return Score (scaled by 100, can be negative)
    function computeScore(uint8 predictedProbability, uint8 realizedOutcome)
        internal pure returns (int256)
    {
        int256 q = int256(predictedProbability);
        int256 r = int256(realizedOutcome);
        
        // S(r, q) = 2qr - q²
        // Scaled by 100 to avoid decimals
        return (2 * q * r - q * q) * 100;
    }
}
```

### Gas Optimization

**Problem**: O(n) loop over all trades is expensive.

**Solution**: Acceptable for hackathon scale (~50-100 trades per market).

**Future Optimization**:
- Track running totals during betting
- Use merkle tree for claims
- Batch processing

---

## Next Steps

- [AI Console](./06-ai-console.md) - Validator transparency documentation
- [Deployment Guide](./07-deployment.md) - Deploy your own instance
- [API Reference](./08-api.md) - Bridge service endpoints
