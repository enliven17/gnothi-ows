# Multi-Agent Systems & Autonomous Economies (Track 4)

Gnothi implements **Track 04: Multi-Agent Systems & Autonomous Economies** by building the trust, payment, and resolution layer for the agentic economy.

---

## Overview

The "Multi-Agent Systems" track focuses on environments where AI agents coordinate, trade, and compete. Gnothi provides the primary infrastructure for this ecosystem:

| Feature | Category | Purpose |
|---------|----------|---------|
| **Prediction Market Agent Swarm** | 04.09 | 5 independent LLM agents (GenLayer) resolving real-world events. |
| **Agent Identity & OWS Wallet** | 02.06 | Every agent holds an OWS-compatible wallet with reputation-gated credentials. |
| **Cross-Chain AI Oracle** | 03.07 | Bridging GenLayer AI consensus results to Base Sepolia via LayerZero. |
| **MarketBot Notification Agent** | 04.02 | AI agents notifying humans of market events and validator votes. |
| **Autonomous Group Treasury** | 04.04 | Shared on-chain vaults (GroupMarket.sol) for collective pool betting. |

---

## 1. Prediction Market Agent Swarm

Gnothi's core innovation is delegating market resolution to a decentralized swarm of AI agents on GenLayer.

### Consensus Mechanism: Optimistic Democracy
- **5 Independent Nodes**: Each node runs a unique LLM prompt to scrape data and analyze evidence.
- **Strict Equality Principle**: Consensus is only reached if all 5 agents agree on the outcome (SIDE_A, SIDE_B, or UNDETERMINED).
- **Anti-Collusion**: Agents operate on the GenLayer testnet, isolated from the EVM trading layer until the result is bridged.

### Key Files
- [bridge/intelligent-contracts/news_pm.py](../../../bridge/intelligent-contracts/news_pm.py): The Python logic running on the agent swarm.
- [bridge/service/src/relay/EvmToGenLayer.ts](../../../bridge/service/src/relay/EvmToGenLayer.ts): The trigger that spawns the swarm.

---

## 2. Agent Identity & OWS Wallet

Every participant in the Gnothi ecosystem—whether human or agent—is identified by an **Open Wallet Standard (OWS)** compatible address.

### OWS Wallet Integration
- **Agent Treasury**: A central agent wallet (pre-seeded in `src/app/api/ows/wallet/route.ts`) handles platform fees and payouts.
- **Reputation Credentials**: The system issues `MarketCredential` objects based on an agent's prediction accuracy and history.

| Route | Function |
|-------|----------|
| `GET /api/ows/wallet` | Lists all agents active in the system. |
| `GET /api/ows/credential` | Returns ZK-compatible identity and accuracy metrics for an agent. |

---

## 3. Cross-Chain AI Oracle

To enable autonomous economies on fast liquid chains like Base, Gnothi bridges AI compute from GenLayer.

- **LayerZero V2**: Acts as the secure transport layer.
- **BridgeForwarder**: Ensures that only authorized GenLayer consensus results can resolve markets on Base Sepolia.
- **Pay-Per-Call**: The `resolve()` function can be extended to include micropayments for the AI compute time used by the agents.

---

## 4. Agent Communication (XMTP)

Autonomous economies require communication between agents and human stakeholders.

### MarketBot Agent
An autonomous XMTP bot monitors the blockchain and notifies users in real-time:
- **Validator Voted**: Notifies when a specific AI agent has cast its vote on GenLayer.
- **Consensus Reached**: Announces the final verdict before it even hits the EVM.
- **Trading Alerts**: Informs users of high-volume markets or expiring bets.

---

## 5. Autonomous Group Treasury

The `GroupMarket.sol` contract enables multi-agent coordination for shared capital.

- **Pool Voting**: Agents or humans can deposit USDC into a shared vault.
- **Collective Betting**: The vault executes bets on prediction markets, distributing winnings proportionally to depositors.
- **Hierarchical Governance**: Future iterations will allow agents to manage these treasuries autonomously based on OWS policies.

---

## Track 04 Compliance Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Agent swarm coordination | ✅ | GenLayer 5-agent consensus |
| Agent identity (OWS) | ✅ | `/api/ows/*` credential routes |
| Autonomous treasury | ✅ | GroupMarket.sol shared pools |
| Agent-to-human messaging | ✅ | XMTP MarketBot notifications |
| Cross-chain data oracle | ✅ | GenLayer ↔ Base Bridge |
| Pay-per-call services | ✅ | Prediction resolution via AI consensus |
