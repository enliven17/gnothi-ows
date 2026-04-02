# Introduction

## What is Gnothi?

Gnothi (Γνωθι - "Know Thyself" in Greek) is a decentralized prediction market protocol that solves the oracle problem for real-world events using AI consensus on GenLayer.

## The Oracle Problem

Prediction markets face a fundamental challenge: **How do you bring real-world outcomes on-chain?**

### Traditional Approaches

| Approach | Problems |
|----------|----------|
| **Centralized Oracles** | Single point of failure, trust required |
| **Human Voting (UMA, Kleros)** | Slow (days/weeks), Sybil attacks, capital manipulation |
| **Data Feeds (Chainlink)** | Limited to deterministic data (prices, not events) |

### The Gnothi Solution

Gnothi delegates market resolution to **GenLayer's AI oracle network**:

1. **5 Independent LLM Agents** scan the internet for evidence
2. **Optimistic Democracy** consensus ensures agreement
3. **Cross-chain bridge** delivers results back to EVM
4. **SCEM scoring** rewards accurate predictions

## How It Works

### 5-Phase Market Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MARKET LIFECYCLE FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

Phase 1          Phase 2           Phase 3          Phase 4         Phase 5
Creation         Trading           Close &          AI Resolution   Payout
                                    Trigger

┌──────┐        ┌──────┐          ┌──────┐         ┌──────┐       ┌──────┐
│ Create│───────│ Trade│──────────│Resolve│────────│ AI   │───────│ Claim│
│Market │        │ Bets │          │ Market│        │Consensus│     │Winnings│
└──────┘        └──────┘          └──────┘         └──────┘       └──────┘
   │               │                  │                │              │
   ▼               ▼                  ▼                ▼              ▼
┌──────────┐  ┌──────────┐    ┌──────────────┐  ┌──────────┐   ┌──────────┐
│BetFactory│  │BetCOFI   │    │ResolutionReq │  │GenLayer  │   │SCEM      │
│deploy    │  │placeBet  │    │event emitted │  │validators│   │payout    │
│contract  │  │(1-99%)   │    │bridge relays │  │scrape &  │   │calculated│
│          │  │          │    │              │  │decide    │   │          │
└──────────┘  └──────────┘    └──────────────┘  └──────────┘   └──────────┘
```

### Phase 1: Market Creation

**Actor**: Market Creator (Admin or approved user)

**Contract**: `BetFactoryCOFI.createNewsBet()`

**Parameters**:
- `question`: The event to predict (e.g., "Will Company X file for bankruptcy this month?")
- `evidenceUrl`: Primary URL for AI validators to check
- `sideAName`: Label for "Yes" outcome
- `sideBName`: Label for "No" outcome
- `endDate`: Trading deadline

**Output**: New `BetCOFI` contract deployed

### Phase 2: Trading

**Actors**: Traders (Users or Bots)

**Contract**: `BetFactoryCOFI.placeBet()`

**Mechanism**:
- Users bet on Side A or Side B
- Confidence level: 1-99% (used for SCEM scoring)
- USDC collateral required
- Market probability updates with each bet

### Phase 3: Market Close & Trigger

**Actor**: Creator, Owner, or Approved Resolver

**Contract**: `BetCOFI.resolve()`

**Events**:
- `ResolutionRequested` emitted with market details
- Bridge service detects event
- Oracle deployed to GenLayer

### Phase 4: AI Resolution (GenLayer)

**Contract**: `NewsOracle` (news_pm.py)

**Process**:

```
┌─────────────────────────────────────────────────────────────────┐
│              GENLAYER AI CONSENSUS PROCESS                      │
└─────────────────────────────────────────────────────────────────┘

1. Web Scraping              2. LLM Analysis
   ┌──────────────┐             ┌──────────────┐
   │gl.nondet.    │             │gl.nondet.    │
   │web.render()  │────────────▶│exec_prompt() │
   │              │             │              │
   │Fetches HTML  │             │5 Independent │
   │from evidence │             │LLM agents    │
   │URL           │             │analyze       │
   └──────────────┘             └──────────────┘
                                        │
                                        ▼
                              3. Consensus
                              ┌──────────────┐
                              │gl.eq_principle│
                              │.strict_eq()   │
                              │              │
                              │Optimistic    │
                              │Democracy     │
                              └──────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             SIDE_A wins        SIDE_B wins        UNDECIDED
             (Event happened)   (Event didn't      (Insufficient
                                happen)            evidence)
```

**Consensus Rules**:
- All 5 validators must agree on the decision
- Output normalized to: `SIDE_A`, `SIDE_B`, or `UNDECIDED`
- If consensus fails → `UNDECIDED` (refunds all bets)

### Phase 5: SCEM Payout

**Contract**: `BetCOFI._applyScemPayout()`

**Formula**: Quadratic Scoring Rule (simplified SCEM)

```
S(r, q) = 2qr - q²

Where:
- r = outcome (100 if correct, 0 if wrong)
- q = predicted probability (1-99)
- S = score (higher = more payout share)
```

**Distribution**:
1. Losers' pool collected
2. Weighted by SCEM score × bond amount
3. Winners receive proportional share
4. `UNDECIDED` → full refund to all

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Smart Contracts** | Solidity 0.8.22 | EVM logic (Base Sepolia) |
| **AI Oracle** | Python (GenLayer) | Market resolution |
| **Cross-Chain** | LayerZero V2 | Base ↔ GenLayer messaging |
| **Frontend** | Next.js 15 + TypeScript | User interface |
| **Scoring** | SCEM Library | Fair payout calculation |
| **Persistence** | Supabase (optional) | Oracle deployment metadata |

## Networks

| Component | Network | Chain ID |
|-----------|---------|----------|
| EVM Contracts | Base Sepolia | 84532 |
| GenLayer Oracle | Bradbury Testnet | 18881 |
| LayerZero EID | Base Sepolia | 40245 |

## Key Innovations

### 1. AI-Oracle Resolution

First prediction market to use **LLM consensus** instead of human voting for real-world event resolution.

### 2. Cross-Chain Architecture

Separation of concerns:
- **Base**: Fast, cheap trading with deep liquidity
- **GenLayer**: Specialized AI computation for resolution

### 3. SCEM-Weighted Payouts

Unlike traditional "winner-takes-all" markets, Gnothi rewards:
- **Early accurate predictors** (higher score)
- **Confident correct bets** (probability calibration)

### 4. AI Transparency Console

Users can watch validators:
- Which URLs they're scraping
- Individual agent decisions
- Consensus formation in real-time

## Example Market

**Question**: "Will the FDA approve Drug X by December 2025?"

**Side A**: "Yes, FDA approval announced"

**Side B**: "No, no approval or rejection"

**Evidence URL**: `https://www.fda.gov/drugs/approved-drugs`

**Trading Period**: 30 days

**Resolution Process**:
1. Trading ends on December 31, 2025
2. GenLayer validators scrape FDA website
3. LLMs analyze approval announcements
4. Consensus reached: `SIDE_A` (approved)
5. Side A bettors receive SCEM-weighted payout from Side B pool

## Next Steps

- [Architecture Overview](./02-architecture.md) - Deep dive into system design
- [Core Components](./03-components.md) - Contract and service details
- [NEWS Market Flow](./04-news-flow.md) - Step-by-step resolution walkthrough
