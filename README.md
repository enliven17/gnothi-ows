# Gnothi

Decentralized prediction market protocol powered by AI consensus. Markets are resolved by a **decentralized swarm of 5 independent LLM agents** (GenLayer) that scrape real-world data, reach consensus, and bridge results back via LayerZero.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.22 (Hardhat) |
| AI Oracle | Python (GenLayer Bradbury Testnet) |
| Cross-Chain Messaging | LayerZero V2 |
| Frontend | Next.js 16 + React 19 + TypeScript |
| Wallet | Privy + Wagmi + Open Wallet Standard |
| Notifications | XMTP (MarketBot agent) |
| Database | Supabase |
| Test Token | MockUSDL (ERC-20) |

## Architecture

```mermaid
graph TB
    subgraph Users
        Creator[Market Creator]
        Bettor[Traders]
        Resolver[Resolver]
    end

    subgraph Frontend["Frontend (Next.js 16)"]
        UI[Market UI]
        AIC[AI Console]
        Wallet[Wallet Integration]
    end

    subgraph BaseSepolia["Base Sepolia (EVM)"]
        Factory[BetFactoryCOFI<br/>Market Factory]
        BetCOFI[BetCOFI<br/>Individual Markets]
        GroupMarket[GroupMarket<br/>Shared Treasury]
        SCEM[SCEMScoring<br/>Payout Calculator]
        BridgeRecv[BridgeReceiver<br/>LayerZero Endpoint]
        USDC[MockUSDL Token]
    end

    subgraph Bridge["Bridge Service (Node.js)"]
        Evm2GL[EvmToGenLayer<br/>Event Polling]
        AutoResolve[AutoResolver<br/>Resolution Queue]
        OracleReg[Oracle Registry]
        MarketBot[XMTP MarketBot]
        API[HTTP API]
    end

    subgraph GenLayer["GenLayer Bradbury (AI)"]
        NewsOracle[NewsOracle.py<br/>AI Consensus]
        BridgeSend[BridgeSender.py<br/>Cross-Chain Relay]
        Validators[5x LLM Agents<br/>Web Scraping + Analysis]
    end

    Creator -->|Create Market| Factory
    Bettor -->|Place Bets| Factory
    Resolver -->|Trigger Resolution| BetCOFI

    Factory -->|Deploys| BetCOFI
    Factory -->|Routes| BetCOFI
    BetCOFI -->|Uses| SCEM
    BetCOFI -->|Transfers| USDC
    Factory -->|Status Tracking| Factory

    BetCOFI -->|ResolutionRequested Event| Evm2GL
    Evm2GL -->|Deploys Oracle| NewsOracle
    NewsOracle -->|Web Scraping + LLM| Validators
    Validators -->|Optimistic Democracy| NewsOracle
    NewsOracle -->|Send Resolution| BridgeSend

    BridgeSend -->|LayerZero V2 Message| BridgeRecv
    BridgeRecv -->|processBridgeMessage| Factory
    Factory -->|setResolution| BetCOFI

    Evm2GL -.->|Records| OracleReg
    AutoResolve -.->|Monitors| Factory
    MarketBot -.->|Notifications| Bettor
    API -.->|Oracle Status| AIC

    UI -->|Reads| Factory
    UI -->|Reads| BetCOFI
    AIC -->|Polls| API
    Wallet -->|Signs Transactions| Bettor
```

## How It Works

### Market Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CREATED: createNewsBet()
    CREATED --> ACTIVE: Market Deployed
    ACTIVE --> ACTIVE: placeBet()
    ACTIVE --> RESOLVING: resolve() [after endDate]
    RESOLVING --> AI_CONSENSUS: Bridge deploys GenLayer oracle
    AI_CONSENSUS --> RESOLVED: sideAWins=true
    AI_CONSENSUS --> RESOLVED: sideAWins=false
    AI_CONSENSUS --> UNDETERMINED: no consensus
    RESOLVED --> [*]: claim() [SCEM payout]
    UNDETERMINED --> [*]: claim() [full refund]
    RESOLVING --> UNDETERMINED: cancelBet() [7 day timeout]
```

### Resolution Flow

```mermaid
sequenceDiagram
    participant User
    participant BetCOFI
    participant Factory
    participant Bridge
    participant GenLayer
    participant LayerZero
    participant BridgeRecv

    User->>BetCOFI: resolve() [after endDate]
    BetCOFI->>Factory: forwardResolutionRequest(NEWS)
    Factory-->>Bridge: ResolutionRequested Event
    Bridge->>GenLayer: Deploy NewsOracle.py
    GenLayer->>GenLayer: 5x LLM agents scrape evidence URL
    GenLayer->>GenLayer: Optimistic Democracy consensus
    GenLayer->>LayerZero: send_message(resolution)
    LayerZero->>BridgeRecv: lzReceive(payload)
    BridgeRecv->>Factory: processBridgeMessage()
    Factory->>BetCOFI: setResolution(resolutionData)
    BetCOFI->>BetCOFI: _applyScemPayout()
    BetCOFI-->>User: claim() [SCEM-weighted payout]
```

### AI Consensus Process

```mermaid
flowchart TD
    A[Deploy NewsOracle.py] --> B[Fetch Evidence URL]
    B --> C{Content Valid?}
    C -->|No| D[Return UNDECIDED]
    C -->|Yes| E[Build LLM Prompt]
    E --> F[5x LLM Agents Analyze]
    F --> G{Consensus Check<br/>strict_eq}
    G -->|All Agree SIDE_A| H[sideAWins = true]
    G -->|All Agree SIDE_B| I[sideAWins = false]
    G -->|Disagreement| D
    H --> J[Encode Resolution]
    I --> J
    D --> J
    J --> K[Send via LayerZero V2]
```

### SCEM Payout Distribution

```mermaid
flowchart LR
    subgraph Losers
        L1[Carol: 80 USDC @ 80%]
        L2[Dave: 30 USDC @ 50%]
    end

    subgraph Winners
        W1[Alice: 100 USDC @ 75%<br/>Score: 9375]
        W2[Bob: 50 USDC @ 60%<br/>Score: 8400]
    end

    subgraph Pool
        LP[Losers Pool: 110 USDC]
    end

    subgraph Distribution
        D1[Alice: 175.93 USDC<br/>+75.93 profit]
        D2[Bob: 84.07 USDC<br/>+34.07 profit]
    end

    L1 --> LP
    L2 --> LP
    LP -->|Weighted by SCEM Score × Bond| D1
    LP -->|Weighted by SCEM Score × Bond| D2
    W1 -.-> D1
    W2 -.-> D2
```

Winners receive their bond back plus a share of the losers' pool, weighted by their SCEM score:

```
S(r, q) = 2qr - q²

Where:
  r = realized outcome (100 for correct, 0 for wrong)
  q = predicted probability (1-99)
```

## Project Structure

```
gnothi-ows/
├── contracts/                          # Solidity smart contracts
│   ├── contracts/
│   │   ├── BetFactoryCOFI.sol          # Market factory + resolution routing
│   │   ├── BetCOFI.sol                 # Individual prediction market
│   │   ├── GroupMarket.sol             # Shared treasury for collective bets
│   │   ├── SCEMScoring.sol             # Quadratic scoring rule library
│   │   ├── interfaces/
│   │   └── mocks/                      # MockUSDL test token
│   ├── scripts/                        # Deployment scripts
│   ├── test/                           # Hardhat tests
│   └── hardhat.config.ts
│
├── frontend/                           # Next.js 16 web application
│   ├── src/
│   │   ├── app/                        # App router pages
│   │   │   ├── page.tsx                # Landing page
│   │   │   ├── markets/                # Market listing + detail
│   │   │   ├── admin/                  # Market creation
│   │   │   ├── docs/                   # In-app documentation
│   │   │   └── components/
│   │   │       ├── AIConsole/          # Real-time validator transparency
│   │   │       ├── MarketCard/         # Market preview
│   │   │       ├── MarketDetailPanel/  # Full market view
│   │   │       ├── GroupMarket/        # Group betting panel
│   │   │       ├── OWSWallet/          # Open Wallet Standard panel
│   │   │       └── LandingView/        # Hero + architecture diagrams
│   │   ├── lib/                        # Contract hooks + utilities
│   │   └── types/                      # TypeScript definitions
│   └── package.json
│
├── bridge/
│   ├── service/                        # Node.js relay service
│   │   └── src/
│   │       ├── relay/
│   │       │   ├── EvmToGenLayer.ts    # Base → GenLayer event relay
│   │       │   └── GenLayerToEvm.ts    # GenLayer → Base message relay
│   │       ├── resolution/
│   │       │   ├── AutoResolver.ts     # Automated resolution queue
│   │       │   ├── LoopMarketScheduler.ts
│   │       │   ├── StuckResolvingScanner.ts
│   │       │   ├── ExpiredMarketSweeper.ts
│   │       │   └── OracleRegistry.ts   # Deployment metadata tracking
│   │       ├── xmtp/
│   │       │   └── marketBot.ts        # XMTP notification agent
│   │       ├── ows/
│   │       │   └── OWSVault.ts         # Open Wallet Standard vault
│   │       ├── api/
│   │       │   └── ResolutionAPI.ts    # HTTP API for oracle status
│   │       └── db/
│   │           └── supabase.ts         # Supabase client
│   │
│   ├── intelligent-contracts/          # Python GenLayer contracts
│   │   └── news_pm.py                  # NEWS market oracle (canonical)
│   │
│   └── smart-contracts/                # Bridge smart contracts (zkSync)
│       └── contracts/
│           ├── BridgeReceiver.sol      # LayerZero message receiver
│           └── BridgeForwarder.sol
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql             # Oracle registry schema
│
└── docs/                               # Documentation
    ├── 01-introduction.md
    ├── 02-architecture.md
    ├── 03-components.md
    ├── 04-news-flow.md
    ├── 05-scem.md
    ├── 06-ai-console.md
    ├── 07-deployment.md
    ├── 08-api.md
    ├── 09-troubleshooting.md
    └── 10-diagrams.md
```

## Quick Start

### Contracts

```bash
cd contracts && npm install
npm run compile              # Compile + sync artifacts
npm run test                 # Run tests
npm run deploy:sepolia       # Deploy to Base Sepolia
```

### Frontend

```bash
cd frontend && npm install
cp .env.example .env.local   # Configure environment
npm run dev                  # Start at localhost:3000
```

### Bridge Service

```bash
cd bridge/service && npm install
cp .env.example .env         # Configure environment
npm run dev                  # Start at localhost:3001
```

## Networks

| Component | Network | Chain ID | LZ EID |
|-----------|---------|----------|--------|
| EVM Contracts | Base Sepolia | 84532 | 40245 |
| GenLayer AI | Bradbury Testnet | 18881 | — |

## Key Features

### AI-Oracle Resolution

Markets resolve through a decentralized swarm of 5 independent LLM agents that:
1. Scrape the evidence URL for real-world data
2. Analyze using fact-checking prompts
3. Reach consensus via Optimistic Democracy (`strict_eq`)
4. Bridge results back via LayerZero V2

### SCEM-Weighted Payouts

Unlike winner-takes-all markets, Gnothi rewards **early and confident** correct predictions using the Quadratic Scoring Rule. Higher SCEM scores earn a larger share of the losers' pool.

### AI Transparency Console

Users can watch resolution in real-time:
- Which URLs validators are scraping
- Individual agent decisions
- Consensus formation progress

### Group Markets

Shared on-chain treasuries enable collective betting where multiple participants pool funds and share outcomes.

### XMTP Notifications

MarketBot agent autonomously notifies users on market events and validator votes via XMTP.

### Open Wallet Standard (OWS)

Reputation-gated agent wallets via the Open Wallet Standard for autonomous agent participation.

## Documentation

Full documentation is available in the [`docs/`](./docs/) directory:

| Document | Content |
|----------|---------|
| [Introduction](./docs/01-introduction.md) | Oracle problem, Gnothi solution |
| [Architecture](./docs/02-architecture.md) | System design, data flow diagrams |
| [Components](./docs/03-components.md) | Contract and service details |
| [NEWS Flow](./docs/04-news-flow.md) | End-to-end market walkthrough |
| [SCEM](./docs/05-scem.md) | Scoring mathematics |
| [AI Console](./docs/06-ai-console.md) | Validator transparency |
| [Deployment](./docs/07-deployment.md) | Step-by-step deployment |
| [API](./docs/08-api.md) | Bridge service HTTP API |
| [Troubleshooting](./docs/09-troubleshooting.md) | Common issues |
| [Diagrams](./docs/10-diagrams.md) | Visual diagrams |

## License

MIT — see [LICENSE](./LICENSE) for details.
