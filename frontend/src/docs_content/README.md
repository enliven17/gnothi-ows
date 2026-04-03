# Gnothi Documentation

> **AI-Oracle Powered Prediction Markets on GenLayer**

Welcome to the Gnothi documentation. This guide covers everything from basic concepts to advanced deployment.

---

## 📚 Documentation Index

### Getting Started

| Document | Description |
|----------|-------------|
| [Introduction](./01-introduction.md) | What is Gnothi, the oracle problem, and how AI consensus solves it |
| [Architecture Overview](./02-architecture.md) | System design, component diagrams, and data flow |
| [Core Components](./03-components.md) | Smart contracts, bridge service, and frontend details |

### Deep Dives

| Document | Description |
|----------|-------------|
| [NEWS Market Flow](./04-news-flow.md) | Complete end-to-end walkthrough of market resolution |
| [SCEM Payout Mechanism](./05-scem.md) | Mathematical foundation of fair payout distribution |
| [AI Console](./06-ai-console.md) | Real-time validator transparency feature |

### The Commons (Track 04)

| Document | Description |
|----------|-------------|
| [The Commons](./11-commons.md) | XMTP group chat, MarketBot, MoonPay onramp, GroupMarket treasury |

### Operations

| Document | Description |
|----------|-------------|
| [Deployment Guide](./07-deployment.md) | Step-by-step deployment instructions |
| [API Reference](./08-api.md) | Complete bridge service HTTP API documentation |
| [Troubleshooting](./09-troubleshooting.md) | Common issues and solutions |

---

## 🚀 Quick Start

### For Developers

```bash
# 1. Clone repository
git clone https://github.com/enliven17/gnothi.git
cd gnothi

# 2. Install dependencies
cd contracts && npm install
cd ../frontend && npm install
cd ../bridge/service && npm install

# 3. Configure environment
# See ./07-deployment.md for detailed setup

# 4. Start development
cd contracts && npm run compile
cd ../frontend && npm run dev
cd ../bridge/service && npm run dev
```

### For Users

1. **Connect Wallet**: Navigate to the app and connect your wallet
2. **Browse Markets**: Explore active prediction markets
3. **Place Bets**: Bet on outcomes with confidence levels (1-99%)
4. **Watch Resolution**: Track AI validators resolving markets in real-time
5. **Claim Winnings**: Receive SCEM-weighted payouts

---

## 🎯 Key Concepts

### What is Gnothi?

Gnothi is a **cross-chain prediction market protocol** that uses AI consensus to resolve real-world events.

### How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Create     │────▶│    Trade     │────▶│   Resolve    │
│   Market     │     │   Bets       │     │  with AI     │
└──────────────┘     └──────────────┘     └──────────────┘
     │                    │                    │
     ▼                    ▼                    ▼
 Base Sepolia        Base Sepolia     GenLayer + Bridge
 (EVM)               (EVM)            (AI Consensus)
```

### Core Innovations

1. **AI Oracle Resolution**: 5 LLM agents reach consensus via Optimistic Democracy
2. **Cross-Chain Architecture**: Base ↔ GenLayer communication via LayerZero
3. **SCEM-Weighted Payouts**: Mathematically optimal incentive mechanism
4. **AI Transparency Console**: Real-time visibility into validator decisions
5. **XMTP Group Chat**: Per-market group conversations powered by XMTP v3
6. **Group Treasury**: Pool USDC on-chain and bet collectively via GroupMarket.sol
7. **MoonPay Onramp**: Buy USDC with a card — no CEX, no bridge, no friction
8. **MarketBot Agent**: XMTP bot pushes resolution events into every market chat

---

## 📖 Reading Guide

### First-Time Users

Start here:
1. [Introduction](./01-introduction.md) - Understand what Gnothi is
2. [NEWS Market Flow](./04-news-flow.md) - See how a market works
3. [AI Console](./06-ai-console.md) - Learn about the transparency feature

### Developers

Start here:
1. [Architecture Overview](./02-architecture.md) - System design
2. [Core Components](./03-components.md) - Contract and service details
3. [Deployment Guide](./07-deployment.md) - Deploy your own instance

### Integrators

Start here:
1. [API Reference](./08-api.md) - HTTP API documentation
2. [Core Components](./03-components.md) - Contract interfaces
3. [SDK Usage](./08-api.md#sdk-usage) - TypeScript client examples

---

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GNOTHI ECOSYSTEM                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   BASE SEPOLIA       │         │   GENLAYER           │
│   (Trading Layer)    │         │   (Resolution Layer) │
│                      │         │                      │
│  • BetFactoryCOFI    │         │  • NewsOracle.py     │
│  • BetCOFI           │◄───────▶│  • AI Consensus      │
│  • SCEM Scoring      │  LZ V2  │  • Validator Network │
│  • USDC Payments     │         │  • Web Scraping      │
└──────────────────────┘         └──────────────────────┘
         │                               │
         └───────────┬───────────────────┘
                     │
         ┌───────────▼───────────┐
         │   Bridge Service      │
         │   (Node.js Relay)     │
         │   • Event Polling     │
         │   • Oracle Deployment │
         │   • HTTP API          │
         └───────────────────────┘
                     │
         ┌───────────▼───────────┐
         │   Frontend (Next.js)  │
         │   • Market UI         │
         │   • AI Console        │
         │   • XMTP Group Chat   │
         │   • MoonPay Onramp    │
         │   • Group Treasury    │
         └───────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Smart Contracts** | Solidity 0.8.22 | EVM logic (Base Sepolia) |
| **AI Oracle** | Python (GenLayer) | Market resolution |
| **Cross-Chain** | LayerZero V2 | Base ↔ GenLayer messaging |
| **Frontend** | Next.js 16 + TypeScript | User interface |
| **Scoring** | SCEM Library | Fair payout calculation |
| **Bridge** | Node.js + Express | Event relay + HTTP API |
| **Group Chat** | XMTP v3 browser-sdk | Per-market group conversations |
| **Notifications** | XMTP Agent (MarketBot) | Automated event notifications |
| **Onramp** | MoonPay signed-URL | Fiat → USDC without CEX |
| **Group Capital** | GroupMarket.sol | Shared treasury + collective bets |
| **Wallet API** | OWS-compatible routes | Agent skill integration |

---

## 🎓 Learning Resources

### Videos

- [Gnothi Demo](https://youtube.com/...) - 5-minute walkthrough
- [How AI Consensus Works](https://youtube.com/...) - Technical deep dive
- [SCEM Explained](https://youtube.com/...) - Payout mechanism tutorial

### Tutorials

- [Create Your First Market](./tutorials/create-market.md)
- [Deploy to Testnet](./tutorials/deploy-testnet.md)
- [Build on Top of Gnothi](./tutorials/build-on-gnothi.md)

### Examples

- [Sample Market Creation](./examples/create-market.ts)
- [Bridge Service Integration](./examples/bridge-integration.ts)
- [AI Console Component](./examples/ai-console.tsx)

---

## 🔗 External Links

- **GitHub**: https://github.com/enliven17/gnothi
- **App**: https://app.gnothi.xyz
- **Twitter**: https://twitter.com/gnothi
- **Discord**: https://discord.gg/gnothi
- **GenLayer**: https://genlayer.org
- **LayerZero**: https://layerzero.network

---

## 📊 Market Status

| Network | Status | Contracts |
|---------|--------|-----------|
| Base Sepolia | ✅ Active | [View](./07-deployment.md#contract-addresses) |
| GenLayer Bradbury | ✅ Active | [View](./07-deployment.md#genlayer-oracle-deployment) |
| Base Mainnet | 🔜 Coming Soon | - |

---

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./10-contributing.md) for details.

### Quick Links

- [Open Issues](https://github.com/enliven17/gnothi/issues)
- [Development Setup](./07-deployment.md)
- [Code Style Guide](./10-contributing.md#code-style)

---

## 📜 License

MIT License - see [LICENSE](../LICENSE) for details.

---

## 📞 Support

- **Documentation**: https://docs.gnothi.xyz
- **Discord**: https://discord.gg/gnothi
- **Email**: support@gnothi.xyz

---

## 📝 Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-04-01 | 1.0.0 | Initial documentation release |
| 2025-04-01 | 1.0.1 | Added troubleshooting guide |
| 2026-04-03 | 2.0.0 | The Commons integration: XMTP group chat, MarketBot, MoonPay, GroupMarket.sol |

---

**Last Updated**: April 3, 2026
