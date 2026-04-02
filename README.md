# Gnothi

Decentralized prediction market protocol on Base Sepolia. Markets are resolved by GenLayer intelligent contracts — 5 independent LLM agents scrape real-world data, reach consensus, and bridge results back via LayerZero.

## Repo Structure

```
gnothi/
├── contracts/          — Solidity contracts (Base Sepolia)
├── frontend/           — Next.js 15 UI
├── bridge/service/     — TypeScript relay + resolution scheduler
├── bridge/intelligent-contracts/  — Python oracle contracts (GenLayer)
├── docs/               — Full documentation
└── supabase/           — SQL migrations
```

---

## How It Works

```
Frontend (Next.js + Wagmi + Privy)
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
2. Bridge service catches `ResolutionRequested` event from Base Sepolia
3. Deploys Python intelligent contract to GenLayer
4. 5 independent LLM agents fetch data (CoinMarketCap / Yahoo Finance / evidence URL)
5. Optimistic Democracy consensus reached
6. Result bridges back via LayerZero → BridgeReceiver → BetFactoryCOFI → BetCOFI
7. Winners claim via `bet.claim()` with SCEM-weighted payout

### Market States

```
ACTIVE → (resolve()) → RESOLVING → (AI consensus) → RESOLVED
                                                   → UNDETERMINED (refund)
```

---

## Quick Start

### Contracts

```bash
cd contracts
npm install
npm run compile
npm test
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # localhost:3000
```

### Bridge Service

```bash
cd bridge/service
npm install
npm run dev        # localhost:3001
```

---

## Environment

### Contracts (`contracts/.env`)

```bash
PRIVATE_KEY=                    # Deployer wallet
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=               # For contract verification
```

### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_BET_FACTORY_ADDRESS=
NEXT_PUBLIC_MOCK_USDL_ADDRESS=
NEXT_PUBLIC_BRIDGE_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_OWNER_ADDRESS=
NEXT_PUBLIC_GENLAYER_RPC_URL=https://rpc.genlayer.net
```

### Bridge Service (`bridge/service/.env`)

```bash
PRIVATE_KEY=                    # Relayer wallet (must be approvedCreator + approvedResolver)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BET_FACTORY_ADDRESS=
GENLAYER_RPC_URL=https://rpc.genlayer.net
BRIDGE_SENDER_ADDRESS=          # GenLayer BridgeSender contract
BRIDGE_FORWARDER_ADDRESS=       # LayerZero forwarder (optional)
FORWARDER_NETWORK_RPC_URL=      # Forwarder network RPC (optional)
SUPABASE_URL=                   # Optional — persistent oracle registry
SUPABASE_ANON_KEY=
LOOP_MARKETS_ENABLED=true       # Auto-create 5-min BTC/ETH markets
HTTP_PORT=3001
```

---

## Key Scripts

```bash
# Approve bridge wallet as creator + resolver (run with owner key)
PRIVATE_KEY=0xOWNER_KEY FACTORY_ADDRESS=0x... RESOLVER_ADDRESS=0x... \
  npx hardhat run contracts/scripts/approve-resolver.ts --network baseSepolia

# Manually resolve all expired markets
npx hardhat run contracts/scripts/resolve-all-expired.ts --network baseSepolia

# Sync ABIs from contracts to frontend
cd contracts && npm run compile
```

---

## SCEM Payout

Winners are rewarded using the **Quadratic Scoring Rule** — early, confident, correct predictions earn more:

```
S(r, q) = 2qr - q²

r = outcome (100 correct, 0 wrong)
q = predicted probability (1–99)
```

Losers' pool is distributed proportionally to winners' SCEM scores × bond amounts.

---

## Loop Markets

The bridge service auto-creates self-renewing 5-minute BTC/ETH direction markets:

- Enabled via `LOOP_MARKETS_ENABLED=true`
- Resolution jobs persist to `resolution-queue.json` — survive service restarts
- Oracle reads opening price from market title: `"BTC/USD: UP or DOWN? (Open: $68,107)"`
- New cycle starts automatically ~25 seconds after each resolution

---

## Docs

Full documentation in [`docs/`](./docs/):

| File | Content |
|------|---------|
| [01-introduction.md](./docs/01-introduction.md) | What is Gnothi, lifecycle overview |
| [02-architecture.md](./docs/02-architecture.md) | System design, data flow diagrams |
| [03-components.md](./docs/03-components.md) | Contract + service reference |
| [04-news-flow.md](./docs/04-news-flow.md) | NEWS market resolution walkthrough |
| [05-scem.md](./docs/05-scem.md) | SCEM scoring mathematics |
| [06-ai-console.md](./docs/06-ai-console.md) | Validator transparency console |
| [07-deployment.md](./docs/07-deployment.md) | Step-by-step deployment guide |
| [08-api.md](./docs/08-api.md) | Bridge service API reference |
| [09-troubleshooting.md](./docs/09-troubleshooting.md) | Common issues |

---

## Networks

| Component | Network | Chain ID |
|-----------|---------|----------|
| EVM Contracts | Base Sepolia | 84532 |
| GenLayer Oracle | Bradbury Testnet | 18881 |
| LayerZero EID | Base Sepolia | 40245 |
