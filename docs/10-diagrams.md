# Visual Diagrams

## System Architecture Diagrams

This document contains detailed visual diagrams of the Gnothi system architecture.

---

## 1. Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GNOTHI SYSTEM OVERVIEW                            │
└─────────────────────────────────────────────────────────────────────────────┘

                                    USERS
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
            ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
            │   Market      │  │    Trader     │  │    Admin      │
            │   Creator     │  │   (Bettor)    │  │  (Resolver)   │
            └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   FRONTEND      │
                              │   (Next.js)     │
                              │                 │
                              │ • Market UI     │
                              │ • AI Console    │
                              │ • Wallet        │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
        ┌───────────────────┐ ┌─────────────────┐ ┌──────────────────┐
        │   BASE SEPOLIA    │ │   BRIDGE        │ │   GENLAYER       │
        │   (EVM)           │ │   SERVICE       │ │   (AI)           │
        │                   │ │   (Node.js)     │ │                  │
        │ ┌───────────────┐ │ │                 │ │ ┌──────────────┐ │
        │ │ BetFactory    │ │ │ ┌─────────────┐ │ │ │ NewsOracle   │ │
        │ │ COFI.sol      │ │ │ │ Event       │ │ │ │ .py          │ │
        │ │               │◄┼─┼─┤ Polling     │ │ │ │              │ │
        │ │ • Create      │ │ │ │             │ │ │ │ • Resolve    │ │
        │ │   Markets     │ │ │ └──────┬──────┘ │ │ │   Markets    │ │
        │ │ • Place Bets  │ │ │        │        │ │ │ • Consensus  │ │
        │ │ • Resolve     │ │ │        │        │ │ │ • Bridge     │ │
        │ └───────┬───────┘ │ │        │        │ │ └───────┬──────┘ │
        │         │         │ │        │        │ │         │        │
        │ ┌───────▼───────┐ │ │ ┌──────▼───────┐│ │ ┌───────▼──────┐ │
        │ │ BetCOFI.sol   │ │ │ │ Oracle      ││ │ │ Bridge       │ │
        │ │               │ │ │ │ Deployment  ││ │ │ Sender       │ │
        │ │ • Trading     │ │ │ │             ││ │ │              │ │
        │ │ • SCEM        │ │ │ │ • Deploy    ││ │ │ • Send       │ │
        │ │   Payout      │ │ │ │   Oracle    ││ │ │   Results    │ │
        │ │ • Claims      │ │ │ │ • Record TX ││ │ │              │ │
        │ └───────┬───────┘ │ │ └──────────────┘│ │ └──────────────┘ │
        │         │         │ │                 │ │                  │
        │ ┌───────▼───────┐ │ │                 │ │                  │
        │ │ Bridge        │ │ │                 │ │                  │
        │ │ Receiver.sol  │ │ │                 │ │                  │
        │ │               │ │ │                 │ │                  │
        │ │ • lzReceive   │ │ │                 │ │                  │
        │ │ • Dispatch    │ │ │                 │ │                  │
        │ └───────────────┘ │ │                 │ │                  │
        └───────────────────┘ └─────────────────┘ └──────────────────┘
                │                      │                    │
                └──────────────────────┼────────────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │   LAYERZERO V2      │
                            │   Cross-Chain       │
                            │   Messaging         │
                            │                     │
                            │ • DVN Verification  │
                            │ • Message Relay     │
                            │ • Finality          │
                            └─────────────────────┘
```

---

## 2. Market Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MARKET LIFECYCLE FLOWCHART                           │
└─────────────────────────────────────────────────────────────────────────────┘

    START
      │
      ▼
┌─────────────────┐
│ PHASE 1:        │
│ MARKET CREATION │
└────────┬────────┘
         │
         │ 1. Admin creates market via frontend
         │ 2. BetFactoryCOFI.deployBetCOFI()
         │ 3. Emit BetCreated event
         │
         ▼
┌─────────────────┐
│    ACTIVE       │◄───────┐
│ STATE           │        │
│                 │        │ Multiple bets
│ • Trading Open  │────────┘
│ • Users place   │
│   bets          │
│ • Probability   │
│   updates       │
└────────┬────────┘
         │
         │ endDate reached
         │ resolve() called
         ▼
┌─────────────────┐
│ PHASE 2:        │
│ RESOLVING       │
│ STATE           │
│                 │
│ • Trading Closed│
│ • Emit          │
│   ResolutionReq │
│ • Bridge detects│
└────────┬────────┘
         │
         │ Bridge deploys oracle
         ▼
┌─────────────────┐
│ PHASE 3:        │
│ AI CONSENSUS    │
│                 │
│ • GenLayer      │
│   validators    │
│   scrape web    │
│ • LLM analysis  │
│ • Consensus     │
│   formation     │
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
         ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ SIDE_A  │   │ SIDE_B  │   │ UNDE-   │
   │ WINS    │   │ WINS    │   │ TERMINED│
   └────┬────┘   └────┬────┘   └────┬────┘
        │             │             │
        │             │             │
        ▼             ▼             ▼
┌─────────────────┐   │     ┌───────────────┐
│ PHASE 4:        │   │     │ PHASE 4:      │
│ SCEM PAYOUT     │   │     │ REFUNDS       │
│                 │   │     │               │
│ • Calculate     │   │     │ • Full refund │
│   scores        │   │     │   to all      │
│ • Distribute    │   │     │ • No penalty  │
│   losers' pool  │   │     │               │
│ • Update claims │   │     │               │
└────────┬────────┘   │     └───────┬───────┘
         │             │             │
         └─────────────┴─────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ PHASE 5:       │
              │ CLAIMING       │
              │                │
              │ • Users call   │
              │   claim()      │
              │ • Receive      │
              │   USDC         │
              │ • Market ends  │
              └────────┬───────┘
                       │
                       ▼
                     END
```

---

## 3. Cross-Chain Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-CHAIN MESSAGE SEQUENCE                             │
└─────────────────────────────────────────────────────────────────────────────┘

BASE SEPOLIA                    LAYERZERO                 GENLAYER
    │                              │                          │
    │  1. resolve()                │                          │
    │  (BetCOFI)                   │                          │
    │──────┐                      │                          │
    │      │                      │                          │
    │      ▼                      │                          │
    │  2. forwardResolutionRequest│                          │
    │  (BetFactoryCOFI)            │                          │
    │──────┐                      │                          │
    │      │                      │                          │
    │      ▼                      │                          │
    │  3. ResolutionRequested     │                          │
    │  Event Emitted               │                          │
    │──────┘                      │                          │
    │                              │                          │
    │                              │ 4. Poll Event            │
    │                              │ (Bridge Service)         │
    │                              │─────────────────────────▶│
    │                              │                          │
    │                              │ 5. Deploy Oracle         │
    │                              │ (news_pm.py)             │
    │                              │─────────────────────────▶│
    │                              │                          │
    │                              │                          │ 6. Web Scraping
    │                              │                          │ (gl.nondet.web.render)
    │                              │                          │──────────┐
    │                              │                          │          │
    │                              │                          │◀─────────┘
    │                              │                          │ 7. LLM Analysis
    │                              │                          │ (gl.nondet.exec_prompt)
    │                              │                          │──────────┐
    │                              │                          │          │
    │                              │                          │◀─────────┘
    │                              │                          │
    │                              │                          │ 8. Consensus
    │                              │                          │ (gl.eq_principle.strict_eq)
    │                              │                          │──────────┐
    │                              │                          │          │
    │                              │                          │◀─────────┘
    │                              │                          │
    │                              │ 9. Send Message          │
    │                              │ (BridgeSender)           │
    │                              │◀─────────────────────────┤
    │                              │                          │
    │                              │                          │
    │ 10. lzReceive                │                          │
    │ (BridgeReceiver)             │                          │
    │◀─────────────────────────────┤                          │
    │                              │                          │
    │ 11. processBridgeMessage     │                          │
    │ (BetFactoryCOFI)             │                          │
    │──────┐                      │                          │
    │      │                      │                          │
    │      ▼                      │                          │
    │ 12. setResolution()          │                          │
    │ (BetCOFI)                   │                          │
    │──────┐                      │                          │
    │      │                      │                          │
    │      ▼                      │                          │
    │ 13. _applyScemPayout()      │                          │
    │ (Calculate winners)         │                          │
    │──────┐                      │                          │
    │      │                      │                          │
    │      ▼                      │                          │
    │ 14. Resolution Complete     │                          │
    │ (Users can claim)           │                          │
    │                              │                          │
```

---

## 4. AI Consensus Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GENLAYER AI CONSENSUS DETAIL                           │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │  NewsOracle.__init__()      │
                    │  Called on deployment       │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │  resolve_market()           │
                    │  (Non-deterministic block)  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Step 1: Web Scraping       │
                    │  ─────────────────────────  │
                    │  content = gl.nondet.web.   │
                    │            render(url)      │
                    │                             │
                    │  Fetches HTML from evidence │
                    │  URL, converts to plain text│
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │  Step 2: Build Prompt       │
                    │  ─────────────────────────  │
                    │  prompt = f"""              │
                    │  <question>{question}</     │
                    │           question>         │
                    │  <evidence_text>{content}</ │
                    │           evidence_text>    │
                    │  Side A: {side_a_name}      │
                    │  Side B: {side_b_name}      │
                    │  Output JSON only:          │
                    │  {{"decision": "SIDE_A"}}   │
                    │  """                        │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │  Step 3: LLM Analysis       │
                    │  ─────────────────────────  │
                    │  result = gl.nondet.        │
                    │           exec_prompt(      │
                    │             prompt          │
                    │           )                 │
                    │                             │
                    │  Each validator runs their  │
                    │  own LLM instance           │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │  Step 4: Decision Parsing   │
                    │  ─────────────────────────  │
                    │  decision = _extract_       │
                    │           decision(result)  │
                    │                             │
                    │  - Remove markdown          │
                    │  - Parse JSON               │
                    │  - Validate: SIDE_A |       │
                    │    SIDE_B | UNDECIDED       │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │  Step 5: Consensus Check    │
                    │  ─────────────────────────  │
                    │  consensus =                │
                    │  gl.eq_principle.strict_eq( │
                    │    fetch_and_decide         │
                    │  )                          │
                    │                             │
                    │  All 5 validators must      │
                    │  agree (character match)    │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
     │  CONSENSUS:     │ │  CONSENSUS:     │ │  NO CONSENSUS:  │
     │  SIDE_A         │ │  SIDE_B         │ │  UNDECIDED      │
     │                 │ │                 │ │                 │
     │  All validators │ │  All validators │ │  Validators     │
     │  agree SIDE_A   │ │  agree SIDE_B   │ │  disagree       │
     │  wins           │ │  wins           │ │  → Fallback     │
     └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
              │                   │                    │
              ▼                   ▼                    ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 6: Bridge Callback                                │
     │  ─────────────────                                      │
     │  _send_resolution_to_bridge()                           │
     │                                                         │
     │  Encode: (marketId, sideAWins, isUndetermined, ...)     │
     │  Send: bridge.emit().send_message()                     │
     │  Via: LayerZero V2                                      │
     └─────────────────────────────────────────────────────────┘
```

---

## 5. SCEM Payout Distribution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCEM PAYOUT CALCULATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

EXAMPLE MARKET: "Will the FDA approve Drug X?"
RESULT: SIDE_A WINS

┌──────────────────────────────────────────────────────────────────────────────┐
│ TRADES                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WINNERS (Side A)                          LOSERS (Side B)                   │
│  ┌────────────────────────────┐           ┌────────────────────────────┐    │
│  │ Alice: 100 USDC @ 75%      │           │ Carol: 80 USDC @ 80%       │    │
│  │ Score: S(100,75) = 9375    │           │ Score: S(0,80) = -6400     │    │
│  └────────────────────────────┘           └────────────────────────────┘    │
│                                                                              │
│  Bob: 50 USDC @ 60%                  Dave: 30 USDC @ 50%                     │
│  Score: S(100,60) = 8400             Score: S(0,50) = -2500                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ CALCULATION STEPS                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PASS 1: Collect Losers' Pool                                                │
│  ────────────────────────────────                                            │
│  losersPool = Carol.bond + Dave.bond                                         │
│             = 80 + 30 = 110 USDC                                             │
│                                                                              │
│  PASS 1: Calculate Winner Scores                                             │
│  ───────────────────────────────────────                                     │
│  Alice: 9375 × 100 = 937,500                                                 │
│  Bob:   8400 × 50  = 420,000                                                 │
│  ───────────────────────────────────────                                     │
│  totalWeightedScore = 1,357,500                                              │
│                                                                              │
│  PASS 2: Distribute Payouts                                                  │
│  ────────────────────────────────                                            │
│  Alice share = (110 × 9375 × 100) / 1,357,500 = 75.93 USDC                   │
│  Alice payout = 100 + 75.93 = 175.93 USDC                                    │
│                                                                              │
│  Bob share   = (110 × 8400 × 50) / 1,357,500 = 34.07 USDC                    │
│  Bob payout  = 50 + 34.07 = 84.07 USDC                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ FINAL DISTRIBUTION                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Trader   │ Side │ Bond In  │ Payout Out │ Profit/Loss │ Score              │
│  ─────────┼──────┼──────────┼────────────┼─────────────┼──────────────────  │
│  Alice    │ A ✓  │ 100 USDC │ 175.93     │ +75.93      │ 9375               │
│  Bob      │ A ✓  │ 50 USDC  │ 84.07      │ +34.07      │ 8400               │
│  Carol    │ B ✗  │ 80 USDC  │ 0          │ -80         │ -6400              │
│  Dave     │ B ✗  │ 30 USDC  │ 0          │ -30         │ -2500              │
│                                                                              │
│  CHECK: 175.93 + 84.07 = 260 = 100 + 50 + 80 + 30 ✓                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENT HIERARCHY                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  App (layout.tsx)                                                        │
│  └── Providers (Privy, Wagmi)                                            │
│      └── Header                                                          │
│          └── WalletButton                                                │
└──────────────────────────────────────────────────────────────────────────┘
         │
         ├── Home (page.tsx)
         │   └── LandingView
         │       └── MarketCard (featured)
         │
         ├── Markets (/markets)
         │   └── MarketList
         │       ├── CategoryFilter
         │       └── MarketCard[]
         │           └── MarketExpanded
         │               ├── MarketDetailPanel
         │               │   ├── Trade Tab
         │               │   ├── AI Oracle Tab
         │               │   │   └── AIConsole
         │               │   │       ├── ValidatorCard[]
         │               │   │       └── ConsensusBanner
         │               │   └── History Tab
         │               └── SCEMPayoutBar
         │
         ├── Market Detail (/markets/[id])
         │   └── MarketDetailPanel
         │       ├── Trade Tab
         │       │   ├── BetForm
         │       │   │   ├── SideSelector
         │       │   │   ├── AmountInput
         │       │   │   └── ConfidenceSlider
         │       │   └── ClaimButton
         │       ├── AI Oracle Tab
         │       │   └── AIConsole
         │       └── History Tab
         │
         ├── Admin (/admin)
         │   └── CreateMarketModal
         │       ├── MarketTypeSelector
         │       ├── QuestionInput
         │       ├── EvidenceUrlInput
         │       ├── SideNamesInput
         │       └── EndDatePicker
         │
         └── GenLayerInfo (/genlayer)
             └── GenLayerInfo
                 ├── ValidatorStats
                 └── OracleDeployments

┌──────────────────────────────────────────────────────────────────────────┐
│  HOOKS                                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  • useMarket()           - Fetch market data from contract               │
│  • useBets()             - Fetch user's bets                             │
│  • useAIConsole()        - Poll GenLayer for validator status            │
│  • useSCEM()             - Calculate potential payouts                   │
│  • useWallet()           - Wallet connection state                       │
│  • useContract()         - Contract instance management                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow Diagrams

### Market Creation Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MARKET CREATION DATA FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND                      CONTRACTS                    EVENTS
    │                            │                            │
    │  createNewsBet()           │                            │
    │  ─────────────────────────▶│                            │
    │  (title, question,         │                            │
    │   evidenceUrl, sideA,      │                            │
    │   sideB, endDate)          │                            │
    │                            │                            │
    │                            │ Deploy BetCOFI             │
    │                            │ ────────────┐              │
    │                            │             │              │
    │                            │◀────────────┘              │
    │                            │ betAddress                 │
    │                            │                            │
    │                            │ Store in factory           │
    │                            │ deployedBets[betAddress]   │
    │                            │ = true                     │
    │                            │                            │
    │                            │ Emit BetCreated            │
    │                            │ ──────────────────────────▶│
    │                            │ event BetCreated(          │
    │                            │   betAddress,              │
    │                            │   creator,                 │
    │                            │   title,                   │
    │                            │   endDate                  │
    │                            │ )                          │
    │                            │                            │
    │◀───────────────────────────│                            │
    │ Transaction Receipt        │                            │
    │                            │                            │
    │ Update UI                  │                            │
    │ Show new market            │                            │
    │                            │                            │
```

### Resolution Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RESOLUTION DATA FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

CONTRACTS         BRIDGE SERVICE        GENLAYER          FRONTEND
    │                    │                  │                 │
    │ resolve()          │                  │                 │
    │──────┐             │                  │                 │
    │      │             │                  │                 │
    │      ▼             │                  │                 │
    │ Emit Event         │                  │                 │
    │ ResolutionRequested│                  │                 │
    │──────┐             │                  │                 │
    │      │             │                  │                 │
    │      │             │ Poll Events      │                 │
    │      │             │──────────┐       │                 │
    │      │             │          │       │                 │
    │      │             │◀─────────┘       │                 │
    │      │             │ Event detected   │                 │
    │      │             │                  │                 │
    │      │             │ Deploy Oracle    │                 │
    │      │             │─────────────────▶│                 │
    │      │             │ (news_pm.py)     │                 │
    │      │             │                  │                 │
    │      │             │                  │ AI Consensus    │
    │      │             │                  │ (2-5 min)       │
    │      │             │                  │                 │
    │      │             │ Return Result    │                 │
    │      │             │◀─────────────────│                 │
    │      │             │                  │                 │
    │      │             │ Record TX Hash   │                 │
    │      │             │──────────┐       │                 │
    │      │             │          │       │                 │
    │      │             │◀─────────┘       │                 │
    │      │             │                  │                 │
    │      │ Cross-Chain │                  │                 │
    │      │ Message     │                  │                 │
    │◀─────┴─────────────│                  │                 │
    │ lzReceive()         │                  │                 │
    │                     │                  │                 │
    │ setResolution()     │                  │                 │
    │ _applyScemPayout()  │                  │                 │
    │                     │                  │                 │
    │ Emit BetResolved    │                  │                 │
    │────────────────────────────────────────────────────────▶│
    │                     │                  │  Poll for TX    │
    │                     │                  │  Update Console │
    │                     │                  │                 │
```

---

## Next Steps

- [Introduction](./01-introduction.md) - Start here for basics
- [Architecture Overview](./02-architecture.md) - Detailed system design
- [Deployment Guide](./07-deployment.md) - Deploy your own instance
