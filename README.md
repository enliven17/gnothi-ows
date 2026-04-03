# Gnothi

Decentralized prediction market protocol on Base Sepolia. Markets are resolved by **GenLayer intelligent contracts** — a decentralized swarm of 5 independent LLM agents that scrape real-world data, reach consensus, and bridge results back via LayerZero.

## 🤖 Multi-Agent Systems & Autonomous Economies (Track 04)

Gnothi is built for the agentic economy, providing the trust and payment layer for autonomous participants.

- **Prediction Market Agent Swarm**: 5 independent LLM agents (GenLayer) resolving real-world events.
- **Agent Identity & OWS Wallet**: Reputation-gated agent wallets via the Open Wallet Standard.
- **Cross-Chain AI Oracle**: Securely bridging GenLayer AI consensus results to Base Sepolia via LayerZero.
- **Agent Communication (XMTP)**: Autonomous notifications on market events and validator votes.
- **Autonomous Group Treasury**: Shared on-chain vaults for collective betting.

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
  ├── GroupMarket     — shared treasury for collective bets
  └── MockUSDL        — testnet ERC-20 betting token

Bridge Service (TypeScript)  ←→  GenLayer AI Swarm (5 nodes)
                             ←→  LayerZero (cross-chain messaging)
                             ←→  XMTP (MarketBot notification agent)
```

### Resolution Flow

1. User/Agent calls `bet.resolve()` after market end date
2. Bridge service catches `ResolutionRequested` event from Base Sepolia
3. Deploys Python intelligent contract to GenLayer
4. **AI Swarm Resolution**: 5 independent LLM agents scrape internet evidence
5. **Optimistic Democracy**: consensus reached only if all agents agree
6. Result bridges back via LayerZero → BridgeReceiver → BetFactoryCOFI → BetCOFI
7. Winners claim via `bet.claim()` with SCEM-weighted payout

---

## Quick Start

### Contracts
```bash
cd contracts && npm install && npm run compile
```

### Frontend
```bash
cd frontend && npm install && npm run dev        # localhost:3000
```

### Bridge Service
```bash
cd bridge/service && npm install && npm run dev  # localhost:3001
```

---

## SCEM Payout

Winners are rewarded using the **Quadratic Scoring Rule** — early, confident, correct predictions earn more:

```
S(r, q) = 2qr - q²
```

Losers' pool is distributed proportionally to winners' SCEM scores × bond amounts.

---

## Docs

Full documentation in [`docs/`](./docs/):

| File | Content |
|------|---------|
| [11-commons.md](./docs/11-commons.md) | **Track 04: Multi-Agent Systems & Autonomous Economies** |
| [01-introduction.md](./docs/01-introduction.md) | What is Gnothi, lifecycle overview |
| [02-architecture.md](./docs/02-architecture.md) | System design, data flow diagrams |
| [06-ai-console.md](./docs/06-ai-console.md) | Real-time AI validator transparency console |
| [07-deployment.md](./docs/07-deployment.md) | Step-by-step deployment guide |

---

## Networks

| Component | Network | Chain ID |
|-----------|---------|----------|
| EVM Contracts | Base Sepolia | 84532 |
| GenLayer AI | Bradbury Testnet | 18881 |
| LayerZero EID | Base Sepolia | 40245 |
