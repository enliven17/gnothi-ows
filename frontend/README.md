# PM Kit — Gnothi Frontend

Prediction market platform powered by GenLayer AI-oracle resolution and SCEM-weighted payouts.

## Quick Start

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Architecture

```
Frontend (Next.js 15 + Wagmi + Privy)
       │
       ▼
Base Sepolia
  ├── BetFactoryCOFI  — factory, deploys markets, routes resolutions
  ├── BetCOFI         — individual market (betting, resolution, claims)
  └── MockUSDL        — testnet ERC-20 betting token

Bridge Service (TypeScript)  ←→  GenLayer (Python oracles)
                             ←→  LayerZero (cross-chain messaging)
```

### Resolution Flow

1. User calls `bet.resolve()` after market end date
2. Bridge service catches `ResolutionRequested` event
3. Deploys Python intelligent contract to GenLayer
4. GenLayer validators (5 independent LLM agents) fetch real-world data and reach consensus
5. Result bridges back via LayerZero → BridgeReceiver → BetFactoryCOFI → BetCOFI
6. Winners claim via `bet.claim()` with SCEM-weighted payout

### Market Types

| Type | Resolution Oracle | Data Source |
|------|-------------------|-------------|
| CRYPTO | `crypto_prediction_market.py` | CoinMarketCap |
| STOCKS | `stock_prediction_market.py` | Yahoo Finance |
| NEWS | `news_pm.py` | Evidence URL (AI scrape) |

### Market Lifecycle

```
ACTIVE → (resolve()) → RESOLVING → (AI consensus) → RESOLVED / UNDETERMINED
```

- `RESOLVED`: SCEM-weighted payouts distributed, winners can claim
- `UNDETERMINED`: Full refund to all bettors (AI couldn't reach consensus)
- 7-day timeout: if oracle doesn't respond, creator can call `cancelBet()`

---

## SCEM Payout

Gnothi uses the **Quadratic Scoring Rule** to reward early and calibrated predictions:

```
S(r, q) = 2qr - q²

r = outcome (100 if correct, 0 if wrong)
q = predicted probability (1–99)
```

Higher confidence on correct predictions earns a larger share of the losers' pool.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/onchain/reads.ts` | Contract read helpers |
| `src/lib/onchain/writes.ts` | Contract write helpers (bet, claim, approve) |
| `src/lib/constants.ts` | Chain config, contract addresses |
| `src/app/providers/WalletProvider.tsx` | Privy + Wagmi setup |
| `src/app/components/MarketCard/` | Market card UI |
| `src/app/components/AIConsole/` | GenLayer validator transparency console |
| `src/utils/formatters.ts` | Date, amount, address formatters |

---

## Environment Variables

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=          # From dashboard.privy.io
NEXT_PUBLIC_BET_FACTORY_ADDRESS=   # Deployed BetFactoryCOFI
NEXT_PUBLIC_MOCK_USDL_ADDRESS=     # MockUSDL token address
NEXT_PUBLIC_BRIDGE_SERVICE_URL=    # http://localhost:3001 (or prod URL)
NEXT_PUBLIC_OWNER_ADDRESS=         # Admin wallet address
NEXT_PUBLIC_GENLAYER_RPC_URL=      # https://rpc.genlayer.net
```

---

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (outputs to .next-build)
npm run lint     # ESLint
```

---

## Loop Markets

The bridge service automatically creates self-renewing 5-minute BTC/ETH direction markets:

- Enabled via `LOOP_MARKETS_ENABLED=true` in bridge service `.env`
- Market title embeds the opening price: `"BTC/USD: UP or DOWN? (Open: $68,107)"`
- Resolution queue persists jobs to `resolution-queue.json` — survives service restarts
- New cycle starts automatically after each resolution

---

## Roadmap

### AMM / Dynamic Odds

**Problem:** Current markets use a fixed proportional share model. In short-duration markets (e.g. 5-minute direction markets), late bettors can observe price movement and place near-risk-free bets.

**Solution:** Replace proportional payouts with an **Automated Market Maker (AMM)** — each bet shifts the odds, making late "obvious" bets unprofitable.

#### Mechanism (Constant Product)

```
p_up  = pool_down / (pool_up + pool_down)
payout_multiplier = (pool_up + pool_down + bet_amount) / (pool_up + bet_amount)
```

Early correct bettors earn more; late pile-ons get worse odds.

#### Contract Changes Required (`BetCOFI.sol`)

1. Replace `totalSideA` / `totalSideB` counters with per-side liquidity pools
2. `bet(side, amount)` returns a **share** quantity based on current pool ratio, not raw USDL
3. `claim()` redeems shares × final pool value
4. Add `getOdds()` view function returning current implied probabilities
5. Seed initial liquidity per market from protocol treasury wallet

#### Frontend Changes

- MarketCard probability bar reads from `getOdds()` — no structural change needed
- Bet input shows live preview: "you will receive X shares at Y% implied odds"

#### Tradeoffs

| | Current (proportional) | AMM |
|---|---|---|
| Late-bet exploit | Yes | No — obvious late bets get bad odds |
| Complexity | Low | Medium (pool math in Solidity) |
| Contract redeployment | No | Yes — breaking change |
| Initial liquidity | Not needed | Required per market |
| Gas cost | Low | Slightly higher |
