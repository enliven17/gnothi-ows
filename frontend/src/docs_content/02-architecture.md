# Architecture Overview

## System Design Principles

Gnothi follows a **hybrid cross-chain architecture** that separates trading execution from AI-based resolution:

### Design Goals

1. **Deterministic Trading**: EVM ensures predictable, auditable market mechanics
2. **Non-Deterministic Resolution**: GenLayer handles AI consensus for real-world events
3. **Asynchronous Communication**: LayerZero bridges results without blocking
4. **Incentive Compatibility**: SCEM aligns trader rewards with truthful predictions

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GNOTHI SYSTEM ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────┐    ┌────────────────────────────────┐
│         BASE SEPOLIA (EVM)             │    │       GENLAYER (AI)            │
│                                        │    │                                │
│  ┌──────────────────────────────────┐  │    │  ┌──────────────────────────┐  │
│  │      BetFactoryCOFI.sol          │  │    │  │    NewsOracle.py         │  │
│  │  ┌────────────────────────────┐  │  │    │  │  ┌────────────────────┐  │  │
│  │  │ • createNewsBet()          │  │  │    │  │  │ • resolve_market() │  │  │
│  │  │ • placeBet()               │  │  │    │  │  │ • web scraping     │  │  │
│  │  │ • processBridgeMessage()   │  │  │    │  │  │ • LLM consensus    │  │  │
│  │  │ • forwardResolutionRequest()│ │  │    │  │  │ • bridge callback  │  │  │
│  │  └────────────────────────────┘  │  │    │  └──────────┬─────────────┘  │  │
│  │                                  │  │    │             │                │  │
│  │  ┌────────────────────────────┐  │  │    │  ┌──────────▼─────────────┐  │  │
│  │  │      BetCOFI.sol           │  │  │    │  │   BridgeSender.py      │  │  │
│  │  │  ┌──────────────────────┐  │  │  │    │  │  ┌──────────────────┐  │  │  │
│  │  │  │ • betOnSideA/B()     │  │  │  │    │  │  │ • send_message() │  │  │  │
│  │  │  │ • resolve()          │  │  │  │    │  │  │ • encode_result  │  │  │  │
│  │  │  │ • setResolution()    │  │  │  │    │  │  └──────────────────┘  │  │  │
│  │  │  │ • _applyScemPayout() │  │  │  │    │  └────────────────────────┘  │  │
│  │  │  └──────────────────────┘  │  │  │    │                                │  │
│  │  │                            │  │  │    │                                │  │
│  │  │  ┌──────────────────────┐  │  │  │    │                                │  │
│  │  │  │ SCEMScoring.sol      │  │  │  │    │                                │  │
│  │  │  │ • computeScore()     │  │  │  │    │                                │  │
│  │  │  └──────────────────────┘  │  │  │    │                                │  │
│  │  └────────────────────────────┘  │  │    │                                │  │
│  │                                  │  │    │                                │  │
│  │  ┌────────────────────────────┐  │  │    │                                │  │
│  │  │  BridgeReceiver.sol        │  │  │    │                                │  │
│  │  │  ┌──────────────────────┐  │  │  │    │                                │  │
│  │  │  │ • lzReceive()        │◄─┼──┼────┼────┼─────────────────────────────▶│  │
│  │  │  │ • processBridgeMessage│ │  │  │    │                                │  │
│  │  │  └──────────────────────┘  │  │  │    │                                │  │
│  │  └────────────────────────────┘  │  │    │                                │  │
│  └──────────────────────────────────┘  │    │                                │
│                                        │    │                                │
│  ┌──────────────────────────────────┐  │    │  ┌──────────────────────────┐  │
│  │   USDC Token (ERC20)             │  │    │  │  GenLayer VM (GenVM)     │  │
│  │  • Collateral for bets           │  │    │  │  • Python contracts      │  │
│  │  • Payout distribution           │  │    │  │  • Non-deterministic ops │  │
│  └──────────────────────────────────┘  │    │  │  • Optimistic Democracy  │  │
│                                        │    │  └──────────────────────────┘  │
└────────────────────────────────────────┘    └────────────────────────────────┘
                    │                                       │
                    │         ┌──────────────────┐          │
                    └─────────┤  LayerZero V2    │──────────┘
                              │  Endpoint        │
                              │  • lzSend        │
                              │  • lzReceive     │
                              └──────────────────┘
```

## Component Interaction Flow

### Market Creation → Resolution Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. createNewsBet(question, evidenceUrl, sideA, sideB, endDate)
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BetFactoryCOFI.sol (Base Sepolia)                                   │
│ ─────────────────────────────────────────────────────────────────── │
│ • Deploys new BetCOFI contract                                      │
│ • Stores deployedBets[betAddress] = true                            │
│ • Emits BetCreated event                                            │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 2. placeBet(betAddress, onSideA, amount, probability)
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BetCOFI.sol (Individual Market)                                     │
│ ─────────────────────────────────────────────────────────────────── │
│ • Records TradeSnapshot(trader, probability, bondAmount, onSideA)   │
│ • Updates totalSideA / totalSideB                                   │
│ • Transfers USDC from bettor to contract                            │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 3. resolve() [after endDate]
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BetCOFI.resolve()                                                   │
│ ─────────────────────────────────────────────────────────────────── │
│ • Checks: msg.sender == creator || approvedResolver                 │
│ • status = RESOLVING                                                │
│ • factory.notifyStatusChange()                                      │
│ • factory.forwardResolutionRequest(NEWS)                            │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 4. ResolutionRequested event emitted
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Bridge Service (Node.js)                                            │
│ ─────────────────────────────────────────────────────────────────── │
│ • EvmToGenLayer.ts polls for ResolutionRequested events             │
│ • Decodes resolutionData: [question, evidenceUrl]                   │
│ • Deploys news_pm.py to GenLayer with market parameters             │
│ • recordOracle() stores tx hash for AI Console                      │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 5. Oracle Deployment to GenLayer
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ NewsOracle.py (GenLayer Bradbury Testnet)                           │
│ ─────────────────────────────────────────────────────────────────── │
│ __init__(market_id, question, evidenceUrl, ...)                     │
│ • question = token_symbol (repurposed field)                        │
│ • evidenceUrl = token_name (repurposed field)                       │
│ • Calls resolve_market() in constructor                             │
│                                                                     │
│ resolve_market():                                                   │
│ • web_content = gl.nondet.web.render(evidenceUrl)                   │
│ • prompt = f"Question: {question} Evidence: {web_content}..."       │
│ • result = gl.nondet.exec_prompt(prompt)                            │
│ • decision = gl.eq_principle.strict_eq(extract_decision)            │
│ • _send_resolution_to_bridge()                                      │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 6. Bridge Message: (marketId, sideAWins, isUndetermined, ...)
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BridgeSender.py (GenLayer)                                          │
│ ─────────────────────────────────────────────────────────────────── │
│ • Encodes resolution data                                           │
│ • emit().send_message(targetChainEid, targetContract, messageBytes) │
│ • Via LayerZero V2                                                  │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 7. Cross-Chain Message Delivery
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BridgeReceiver.sol (Base Sepolia)                                   │
│ ─────────────────────────────────────────────────────────────────── │
│ • lzReceive(sourceChainId, payload)                                 │
│ • Decodes: (targetContract, messageBytes)                           │
│ • Calls BetFactoryCOFI.processBridgeMessage()                       │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 8. processBridgeMessage(sourceChainId, _, message)
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BetFactoryCOFI.processBridgeMessage()                               │
│ ─────────────────────────────────────────────────────────────────── │
│ • Verifies: msg.sender == bridgeReceiver                            │
│ • Decodes: (betAddress, resolutionData)                             │
│ • Calls BetCOFI(betAddress).setResolution(resolutionData)           │
│ • Emits OracleResolutionReceived event                              │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 9. setResolution(bytes calldata message)
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BetCOFI.setResolution()                                             │
│ ─────────────────────────────────────────────────────────────────── │
│ • Decodes: (betAddress, sideAWins, isUndetermined, ...)             │
│ • Validates: betAddress == address(this)                            │
│ • If isUndetermined:                                                │
│     → status = UNDETERMINED                                         │
│     → Emit BetUndetermined                                          │
│ • Else:                                                             │
│     → isResolved = true                                             │
│     → isSideAWinner = sideAWins                                     │
│     → status = RESOLVED                                             │
│     → _applyScemPayout()                                            │
│     → Emit BetResolved                                              │
│ • factory.notifyStatusChange()                                      │
└─────────────────────────────────────────────────────────────────────┘
     │
     │ 10. claim() [by users]
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BetCOFI.claim()                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│ • If UNDETERMINED:                                                  │
│     → payout = betsOnSideA[user] + betsOnSideB[user]                │
│ • If RESOLVED:                                                      │
│     → payout = scemPayout[user]                                     │
│ • Transfers USDC to user                                            │
│ • hasClaimed[user] = true                                           │
│ • Emit WinningsClaimed                                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### State Machine: BetCOFI Contract

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BetCOFI STATE MACHINE                            │
└─────────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   CREATED    │
                    │  (initial)   │
                    └──────┬───────┘
                           │ createBet()
                           ▼
                    ┌──────────────┐
          ┌─────────│    ACTIVE    │─────────┐
          │         │  (trading)   │         │
          │         └──────┬───────┘         │
          │                │                 │
   placeBet()              │ resolve()       │
   (anytime before         │ (after endDate) │
    endDate)               │                 │
          │                ▼                 │
          │         ┌──────────────┐         │
          │         │  RESOLVING   │         │
          │         │(awaiting AI) │         │
          │         └──────┬───────┘         │
          │                │                 │
          │      ┌─────────┴─────────┐       │
          │      │                   │       │
          │      │ setResolution()   │       │
          │      │ (bridge callback) │       │
          │      │                   │       │
          │      ▼                   ▼       │
          │ ┌──────────────┐  ┌──────────────┐
          │ │   RESOLVED   │  │ UNDETERMINED │
          │ │(SCEM payout) │  │  (refunds)   │
          │ └──────┬───────┘  └──────┬───────┘
          │        │                 │
          │        │ claim()         │ claim()
          │        │                 │
          └────────┴─────────────────┘
```

### LayerZero Message Format

```
┌─────────────────────────────────────────────────────────────────────┐
│              LAYERZERO V2 MESSAGE STRUCTURE                         │
└─────────────────────────────────────────────────────────────────────┘

EVM → GenLayer (Oracle Deployment):
┌──────────────────────────────────────────────────────────────────────┐
│ Constructor Arguments (abi.encode):                                  │
│ ──────────────────────────────────────────────────────────────────── │
│ [0] market_id       (address) : BetCOFI contract address             │
│ [1] token_symbol    (string)  : Market question                      │
│ [2] token_name      (string)  : Evidence URL                         │
│ [3] market_title    (string)  : Human-readable title                 │
│ [4] side_a          (string)  : Side A label                         │
│ [5] side_b          (string)  : Side B label                         │
│ [6] bridge_sender   (address) : GenLayer BridgeSender address        │
│ [7] target_chain_eid(uint256) : 40245 (Base Sepolia LZ EID)          │
│ [8] target_contract (address) : BetFactoryCOFI address               │
└──────────────────────────────────────────────────────────────────────┘

GenLayer → EVM (Resolution Result):
┌──────────────────────────────────────────────────────────────────────┐
│ Resolution Data (custom encoding):                                   │
│ ──────────────────────────────────────────────────────────────────── │
│ [0] betAddress      (address) : Target BetCOFI contract              │
│ [1] sideAWins       (bool)    : true if SIDE_A, false if SIDE_B      │
│ [2] isUndetermined  (bool)    : true if UNDECIDED consensus          │
│ [3] timestamp       (uint256) : Resolution timestamp                  │
│ [4] txHash          (bytes32) : GenLayer transaction hash (empty)    │
│ [5] price           (uint256) : 0 (news markets have no price)       │
│ [6] winner          (string)  : "SIDE_A" | "SIDE_B" | "UNDECIDED"    │
│                                                                      │
│ Wrapped for BetFactoryCOFI.processBridgeMessage():                   │
│ ──────────────────────────────────────────────────────────────────── │
│ abi.encode(targetContract, resolutionData)                           │
└──────────────────────────────────────────────────────────────────────┘
```

## Contract Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                  SMART CONTRACT DEPENDENCIES                        │
└─────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   Ownable.sol    │
                    │  (OpenZeppelin)  │
                    └────────┬─────────┘
                             │ inherits
                    ┌────────▼─────────┐
                    │ BetFactoryCOFI   │
                    │                  │
                    │ • owns all       │
                    │   BetCOFI        │
                    │   contracts      │
                    └────────┬─────────┘
                             │ deploys
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───────┐ ┌───▼────────┐ ┌───▼────────┐
     │   BetCOFI #1   │ │  BetCOFI #2│ │  BetCOFI #N│
     │   (Market A)   │ │  (Market B)│ │  (Market N)│
     └────────┬───────┘ └────────────┘ └────────────┘
              │
              │ uses
     ┌────────▼────────┐
     │ SCEMScoring.sol │
     │  (library)      │
     └─────────────────┘

     ┌─────────────────┐         ┌─────────────────┐
     │ IERC20.sol      │         │ LayerZero       │
     │ (USDC Token)    │         │ Endpoint        │
     └─────────────────┘         └─────────────────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼───────┐
                    │BridgeReceiver│
                    │  (Base)      │
                    └──────────────┘
```

## Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CONFIGURATION                         │
└─────────────────────────────────────────────────────────────────────┘

BASE SEPOLIA (Chain ID: 84532, LZ EID: 40245)
─────────────────────────────────────────────────
┌────────────────────────────────────────────────┐
│ Contract           │ Address                   │
├────────────────────────────────────────────────┤
│ BetFactoryCOFI     │ Deployed via script       │
│ BetCOFI (template) │ Deployed by factory       │
│ BridgeReceiver     │ Pre-deployed / Configured │
│ USDC Token         │ Pre-existing              │
└────────────────────────────────────────────────┘

GENLAYER BRADBURY TESTNET (Chain ID: 18881)
─────────────────────────────────────────────────
┌────────────────────────────────────────────────┐
│ Contract           │ Address                   │
├────────────────────────────────────────────────┤
│ BridgeSender       │ Pre-deployed              │
│ NewsOracle         │ Deployed per market       │
│ (news_pm.py)       │ (on-demand)               │
└────────────────────────────────────────────────┘

BRIDGE SERVICE (Node.js)
─────────────────────────────────────────────────
┌────────────────────────────────────────────────┐
│ Component          │ Function                  │
├────────────────────────────────────────────────┤
│ EvmToGenLayer.ts   │ Polls Base, deploys GL    │
│ AutoResolver.ts    │ Routes resolution jobs    │
│ OracleRegistry.ts  │ Records deployment metadata│
│ HTTP API           │ /oracle/tx/:address       │
└────────────────────────────────────────────────┘
```

## Security Model

### Trust Assumptions

| Component | Trust Model | Risk Mitigation |
|-----------|-------------|-----------------|
| **BetFactoryCOFI** | Trustless (code-enforced) | Open source, auditable |
| **GenLayer Consensus** | Economic security (slashing) | 5+ independent validators |
| **LayerZero Bridge** | DVN consensus | Decentralized Verifier Network |
| **Bridge Service** | Semi-trusted (owner-controlled) | Can be decentralized |

### Access Control

```
BetFactoryCOFI:
├── Owner (Admin)
│   ├── setCreatorApproval()
│   ├── setResolverApproval()
│   └── setBridgeReceiver()
│
├── Approved Creators
│   └── createNewsBet()
│
└── Approved Resolvers
    └── resolve() [via BetCOFI]

BetCOFI:
├── Factory (Owner)
│   ├── setResolution()
│   └── notifyStatusChange()
│
├── Creator
│   ├── resolve()
│   └── cancelBet() [after timeout]
│
└── Any User
    └── claim()
```

### Failure Modes

| Scenario | Outcome | Recovery |
|----------|---------|----------|
| **GenLayer consensus fails** | `UNDECIDED` → refunds | Re-deploy oracle |
| **Bridge message lost** | Market stuck in `RESOLVING` | `cancelBet()` after 7 days |
| **USDC transfer fails** | Claim reverts | Fix token contract |
| **LLM produces invalid output** | Normalized to `UNDECIDED` | Graceful degradation |

## Next Steps

- [Core Components](./03-components.md) - Detailed contract and service documentation
- [NEWS Market Flow](./04-news-flow.md) - Complete resolution walkthrough
- [Deployment Guide](./07-deployment.md) - Step-by-step deployment instructions
