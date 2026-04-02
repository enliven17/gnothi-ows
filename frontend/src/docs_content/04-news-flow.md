# NEWS Market Flow

## Complete End-to-End Walkthrough

This document traces a NEWS market from creation through resolution, showing every step in the system.

---

## Timeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEWS MARKET COMPLETE TIMELINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

Day 0                Day 1-30            Day 30            Day 30+2h        Day 30+3h
│                    │                   │                 │              │
▼                    ▼                   ▼                 ▼              ▼
┌──────────┐    ┌──────────┐       ┌──────────┐     ┌──────────┐    ┌──────────┐
│  Create  │    │  Trading │       │  Close   │     │    AI    │    │  Claim   │
│  Market  │───▶│  Active  │──────▶│ & Trigger│────▶│Consensus │───▶│ Payout   │
└──────────┘    └──────────┘       └──────────┘     └──────────┘    └──────────┘
     │                │                  │                │               │
     │                │                  │                │               │
  ~5 min          ~30 days            ~1 min          ~5-10 min        ~30 sec
  gas cost        variable            gas cost        gas cost        gas cost
```

---

## Phase 1: Market Creation

### Actor: Admin / Approved Creator

### Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Admin Panel → Create Market Modal                                │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ fillForm({
                              │   title: "Will the FDA approve Drug X by Dec 2025?",
                              │   question: "Did the FDA announce approval of Drug X in December 2025?",
                              │   evidenceUrl: "https://www.fda.gov/drugs/approved-drugs",
                              │   sideAName: "Yes, FDA approval announced",
                              │   sideBName: "No approval or rejection",
                              │   endDate: "2025-12-31T23:59:59Z"
                              │ })
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEB3: Contract Call                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  const tx = await betFactory.createNewsBet(                                 │
│    title,                                                                   │
│    question,                                                                │
│    evidenceUrl,                                                             │
│    sideAName,                                                               │
│    sideBName,                                                               │
│    endDateUnix                                                              │
│  );                                                                         │
│  await tx.wait();                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Transaction submitted to Base Sepolia
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetFactoryCOFI.createNewsBet()                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. Validate inputs:                                                        │
│     - canCreateBet(msg.sender) == true                                      │
│     - bytes(question).length > 0                                            │
│     - bytes(evidenceUrl).length > 0                                         │
│                                                                             │
│  2. Encode resolution data:                                                 │
│     bytes memory resolutionData = abi.encode(question, evidenceUrl);        │
│                                                                             │
│  3. Deploy BetCOFI contract:                                                │
│     BetCOFI bet = new BetCOFI(                                              │
│       msg.sender,           // creator                                      │
│       title,                                                                │
│       question,             // resolutionCriteria                           │
│       sideAName,                                                            │
│       sideBName,                                                            │
│       endDate,                                                              │
│       usdcToken,                                                            │
│       address(this),        // factory                                      │
│       BetCOFI.ResolutionType.NEWS,                                          │
│       resolutionData                                                        │
│     );                                                                      │
│                                                                             │
│  4. Register deployment:                                                    │
│     allBets.push(betAddress);                                               │
│     deployedBets[betAddress] = true;                                        │
│     activeBets.push(betAddress);                                            │
│                                                                             │
│  5. Emit event:                                                             │
│     emit BetCreated(betAddress, msg.sender, title, endDate);                │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Event: BetCreated
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Update UI                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Show success toast                                                       │
│  - Redirect to market detail page                                           │
│  - Poll for market appearance in list                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gas Cost: ~2-3M gas

### Output

```json
{
  "marketAddress": "0x1234...5678",
  "creator": "0xabcd...efgh",
  "title": "Will the FDA approve Drug X by Dec 2025?",
  "question": "Did the FDA announce approval of Drug X in December 2025?",
  "evidenceUrl": "https://www.fda.gov/drugs/approved-drugs",
  "sideAName": "Yes, FDA approval announced",
  "sideBName": "No approval or rejection",
  "endDate": 1735689599,
  "status": "ACTIVE",
  "txHash": "0xabc123..."
}
```

---

## Phase 2: Trading

### Actors: Traders (Users or Bots)

### Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Market Detail Page                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ User selects:
                              │ - Side: A (Yes)
                              │ - Amount: 100 USDC
                              │ - Confidence: 75%
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEB3: USDC Approval (if first time)                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  await usdcContract.approve(betFactoryAddress, amount);                     │
│  await approvalTx.wait();                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Approval confirmed
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEB3: Place Bet                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  const tx = await betFactory.placeBet(                                      │
│    marketAddress,    // BetCOFI contract                                    │
│    true,            // onSideA = true                                      │
│    100000000,       // amount (6 decimals: 100 USDC)                       │
│    75               // probability (1-99)                                   │
│  );                                                                         │
│  await tx.wait();                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Transaction submitted to Base Sepolia
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetFactoryCOFI.placeBet()                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. Validate:                                                               │
│     - deployedBets[betAddress] == true                                      │
│     - amount > 0                                                            │
│     - probability >= 1 && probability <= 99                                 │
│                                                                             │
│  2. Transfer USDC:                                                          │
│     require(IERC20(usdcToken).transferFrom(msg.sender, betAddress, amount));│
│                                                                             │
│  3. Call BetCOFI:                                                           │
│     BetCOFI(betAddress).betOnSideAViaFactory(msg.sender, amount, prob);     │
│                                                                             │
│  4. Emit event:                                                             │
│     emit BetPlaced(betAddress, msg.sender, true, amount);                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Internal call: BetCOFI.betOnSideAViaFactory()
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetCOFI.betOnSideAViaFactory()                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. Validate:                                                               │
│     - msg.sender == factory                                                 │
│     - block.timestamp < endDate                                             │
│     - status == ACTIVE                                                      │
│                                                                             │
│  2. Update state:                                                           │
│     betsOnSideA[bettor] += amount;                                          │
│     totalSideA += amount;                                                   │
│                                                                             │
│  3. Record trade for SCEM:                                                  │
│     trades.push(TradeSnapshot({                                             │
│       trader: bettor,                                                       │
│       probability: 75,                                                      │
│       bondAmount: 100 USDC,                                                 │
│       onSideA: true                                                         │
│     }));                                                                    │
│                                                                             │
│  4. Emit event:                                                             │
│     emit BetPlacedOnA(bettor, amount, probability);                         │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Events: BetPlaced, BetPlacedOnA
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Update UI                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Show success toast                                                       │
│  - Update market odds display                                               │
│  - Refresh user's position                                                  │
│  - Recalculate SCEM preview                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Market Probability Calculation

After each bet, the market probability updates:

```typescript
// Frontend calculation
const probability = totalSideA / (totalSideA + totalSideB) * 100;

// Example:
// totalSideA = 500 USDC
// totalSideB = 300 USDC
// probability = 500 / 800 * 100 = 62.5%
```

### Gas Cost: ~150K gas per bet

---

## Phase 3: Market Close & Trigger

### Actor: Creator, Owner, or Approved Resolver

### Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONDITION: block.timestamp >= endDate                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Market is now closed for trading                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ User clicks "Resolve Market"
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEB3: Resolve Call                                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  const tx = await betContract.resolve();                                    │
│  await tx.wait();                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Transaction submitted to Base Sepolia
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetCOFI.resolve()                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. Validate:                                                               │
│     - canResolveBet(msg.sender, creator) == true                            │
│     - block.timestamp >= endDate                                            │
│     - status == ACTIVE                                                      │
│                                                                             │
│  2. Update status:                                                          │
│     status = RESOLVING;                                                     │
│     resolutionRequestedAt = block.timestamp;                                │
│                                                                             │
│  3. Notify factory:                                                         │
│     IBetFactoryCOFI(factory).notifyStatusChange(ACTIVE, RESOLVING);         │
│     IBetFactoryCOFI(factory).forwardResolutionRequest(NEWS);                │
│                                                                             │
│  4. Factory emits:                                                          │
│     emit ResolutionRequested(                                               │
│       betContract,     // indexed                                          │
│       creator,         // indexed                                          │
│       2,               // resolutionType: NEWS                             │
│       title,                                                              │
│       sideAName,                                                            │
│       sideBName,                                                            │
│       resolutionData,  // abi.encode(question, evidenceUrl)                │
│       block.timestamp                                                       │
│     );                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Event: ResolutionRequested
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BRIDGE SERVICE: EvmToGenLayer.ts Polling                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  // Polls every 5 seconds                                                   │
│  const events = await factory.queryFilter(filter, fromBlock, toBlock);      │
│                                                                             │
│  for (const event of events) {                                              │
│    const [betContract, creator, resolutionType, title,                      │
│           sideAName, sideBName, resolutionData] = event.args;               │
│                                                                             │
│    // Decode resolution data                                                │
│    const [question, evidenceUrl] = abi.decode(resolutionData);              │
│                                                                             │
│    // Deploy oracle to GenLayer                                             │
│    await deployOracle(betContract, resolutionType, title,                   │
│                     sideAName, sideBName, resolutionData);                  │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gas Cost: ~200K gas

### Bridge Service Logs

```
[EVM→GL] *** ResolutionRequested ***
  Bet: 0x1234...5678
  Creator: 0xabcd...efgh
  Type: NEWS (2)
  Title: Will the FDA approve Drug X by Dec 2025?
  Sides: "Yes, FDA approval announced" vs "No approval or rejection"
  Data: [Did the FDA announce approval of Drug X in December 2025?, https://www.fda.gov/drugs/approved-drugs]
  TX: 0xdef456...

[EVM→GL] Deploying oracle...
  Contract: news_pm.py
  Market ID: 0x1234...5678
  Question: Did the FDA announce approval of Drug X in December 2025?
  Evidence URL: https://www.fda.gov/drugs/approved-drugs
  Title: Will the FDA approve Drug X by Dec 2025?
  Sides: "Yes, FDA approval announced" vs "No approval or rejection"
  Bridge: 0x9876... → EID 40245 → 0xabcd...

[EVM→GL] Deploy TX: 0xgenlayer789...
[EVM→GL] Oracle deployed: 0xoracleaddr...
```

---

## Phase 4: AI Consensus (GenLayer)

### Contract: NewsOracle.py on GenLayer Bradbury Testnet

### Internal Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER: NewsOracle.__init__()                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Constructor arguments:                                                     │
│  [                                                                          │
│    "0x1234...5678",         // market_id                                   │
│    "Did the FDA announce...", // question (token_symbol)                   │
│    "https://www.fda.gov/...", // evidenceUrl (token_name)                  │
│    "Will the FDA approve...", // market_title                              │
│    "Yes, FDA approval announced", // side_a                                 │
│    "No approval or rejection", // side_b                                    │
│    "0x9876...",             // bridge_sender                               │
│    40245,                   // target_chain_eid (Base Sepolia)             │
│    "0xabcd..."              // target_contract (BetFactoryCOFI)            │
│  ]                                                                          │
│                                                                             │
│  State initialization:                                                      │
│  self.market_id = "0x1234...5678"                                           │
│  self.question = "Did the FDA announce approval of Drug X in Dec 2025?"     │
│  self.evidence_url = "https://www.fda.gov/drugs/approved-drugs"             │
│  self.side_a = "Yes, FDA approval announced"                                │
│  self.side_b = "No approval or rejection"                                   │
│                                                                             │
│  Trigger resolution in constructor:                                         │
│  self.resolve_market()                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Non-deterministic block executes
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER: Web Scraping                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  def fetch_and_decide() -> str:                                             │
│                                                                             │
│    # Fetch evidence from URL                                                │
│    web_content = gl.nondet.web.render(self.evidence_url, mode="text")       │
│                                                                             │
│    # Truncate to MAX_WEB_CHARS (3000)                                       │
│    truncated = web_content[:3000] if web_content else ""                    │
│                                                                             │
│    # Fallback for empty content                                             │
│    if not truncated.strip():                                                │
│      return "UNDECIDED"                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Content fetched
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER: LLM Prompt Execution                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│    prompt = f"""You are an objective fact-checker resolving a prediction    │
│    market.                                                                  │
│                                                                             │
│    <question>Did the FDA announce approval of Drug X in December 2025?</    │
│    question>                                                                │
│                                                                             │
│    <evidence_url>https://www.fda.gov/drugs/approved-drugs</evidence_url>    │
│                                                                             │
│    <evidence_text>                                                          │
│    {truncated}                                                              │
│    </evidence_text>                                                         │
│                                                                             │
│    Side A label: "Yes, FDA approval announced"                              │
│    Side B label: "No approval or rejection"                                 │
│                                                                             │
│    Instructions:                                                            │
│    1. Read the evidence text carefully.                                     │
│    2. Decide whether the event described in <question> has occurred         │
│       (SIDE_A wins), has not occurred (SIDE_B wins), or the evidence is     │
│       insufficient (UNDECIDED).                                             │
│    3. Output ONLY a JSON object:                                            │
│       {{"decision": "SIDE_A"}}  or  {{"decision": "SIDE_B"}}  or            │
│       {{"decision": "UNDECIDED"}}                                           │
│    4. Do NOT include any explanation, markdown, or extra text.              │
│    """                                                                      │
│                                                                             │
│    raw_result = gl.nondet.exec_prompt(prompt)                               │
│    decision = _extract_decision(raw_result)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ LLM returns JSON
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER: Decision Extraction                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  def _extract_decision(raw: str) -> str:                                    │
│    try:                                                                     │
│      # Remove markdown code blocks                                          │
│      clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip())           │
│                                                                             │
│      # Parse JSON                                                           │
│      data = json.loads(clean)                                               │
│                                                                             │
│      # Extract and normalize                                                │
│      decision = str(data.get("decision", "UNDECIDED")).upper().strip()      │
│                                                                             │
│      # Validate against allowed values                                      │
│      return decision if decision in {"SIDE_A", "SIDE_B", "UNDECIDED"}       │
│             else "UNDECIDED"                                                │
│    except Exception:                                                        │
│      return "UNDECIDED"                                                     │
│                                                                             │
│  # Example output:                                                          │
│  # raw = '```json\n{"decision": "SIDE_A"}\n```'                             │
│  # decision = "SIDE_A"                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Consensus mechanism
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER: Optimistic Democracy Consensus                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  self.decision = gl.eq_principle.strict_eq(fetch_and_decide)                │
│                                                                             │
│  Process:                                                                   │
│  1. Leader validator executes fetch_and_decide()                            │
│  2. Other 4 validators independently execute same function                  │
│  3. All validators compare results using strict_eq                          │
│  4. If all agree (character-for-character match):                           │
│     → Consensus reached                                                     │
│     → decision = "SIDE_A" (example)                                         │
│  5. If disagreement:                                                        │
│     → Appeal process triggered                                              │
│     → Fallback to UNDECIDED if unresolved                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Consensus reached: SIDE_A
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER: Bridge Callback                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  def _send_resolution_to_bridge(self):                                      │
│    side_a_wins = (self.decision == "SIDE_A")  # True                        │
│    is_undetermined = (self.decision == "UNDECIDED")  # False                │
│    timestamp = int(datetime.now().timestamp())                              │
│    tx_hash = bytes(32)  # Empty for now                                     │
│                                                                             │
│    # Encode resolution data                                                 │
│    resolution_abi = [Address, bool, bool, u256, bytes, u256, str]           │
│    resolution_data = encode([                                             │
│      Address(self.market_id),   # "0x1234...5678"                          │
│      side_a_wins,               # True                                      │
│      is_undetermined,           # False                                     │
│      u256(timestamp),           # Unix timestamp                            │
│      tx_hash,                   # bytes32(0)                                │
│      u256(0),                   # price = 0 (news markets)                  │
│      self.decision              # "SIDE_A"                                  │
│    ])                                                                       │
│                                                                             │
│    # Wrap for BetFactoryCOFI.processBridgeMessage                           │
│    wrapper_abi = [Address, bytes]                                           │
│    message_bytes = encode([                                                 │
│      Address(self.market_id),   # Target contract                           │
│      resolution_data              │
│    ])                                                                       │
│                                                                             │
│    # Send via LayerZero                                                     │
│    bridge = gl.get_contract_at(self.bridge_sender)                          │
│    bridge.emit().send_message(                                              │
│      self.target_chain_eid,     # 40245 (Base Sepolia)                      │
│      self.target_contract,      # BetFactoryCOFI address                    │
│      message_bytes                                                        │
│    )                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ LayerZero message sent
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENLAYER → BASE SEPOLIA: Cross-Chain Delivery                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  LayerZero DVN (Decentralized Verifier Network):                            │
│  1. Validates message authenticity                                          │
│  2. Relays to Base Sepolia BridgeReceiver                                   │
│  3. Gas paid from original lzSend() call                                    │
│                                                                             │
│  Delivery time: ~1-5 minutes (depends on finality)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Consensus Time: ~2-5 minutes

### Validator Display (AI Console)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI Oracle Resolution - Live                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Validator 1  ✓  Scanning FDA.gov...         → SIDE_A                      │
│  Validator 2  ✓  Analyzing evidence...       → SIDE_A                      │
│  Validator 3  ✓  Cross-referencing...        → SIDE_A                      │
│  Validator 4  ✓  Finalizing decision...      → SIDE_A                      │
│  Validator 5  ✓  Submitting consensus...     → SIDE_A                      │
│                                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                             │
│  Consensus: SIDE_A ✅  (5/5 validators agreed)                              │
│                                                                             │
│  Decision: "Yes, FDA approval announced"                                    │
│  Evidence: https://www.fda.gov/drugs/approved-drugs                         │
│  Timestamp: 2025-12-31 14:32:15 UTC                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Resolution & Payout

### Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BridgeReceiver.lzReceive()                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  function lzReceive(                                                        │
│    uint32 _sourceChainId,                                                   │
│    bytes calldata _payload                                                  │
│  ) external {                                                               │
│    // Decode: (targetContract, messageBytes)                                │
│    (address targetContract, bytes memory message) =                         │
│      abi.decode(_payload, (address, bytes));                                │
│                                                                             │
│    // Call BetFactoryCOFI                                                   │
│    BetFactoryCOFI(targetContract).processBridgeMessage(                     │
│      _sourceChainId,                                                        │
│      _payload,                                                              │
│      message                                                                │
│    );                                                                       │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Internal call
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetFactoryCOFI.processBridgeMessage()                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  function processBridgeMessage(                                             │
│    uint32 _sourceChainId,                                                   │
│    address,                                                                 │
│    bytes calldata _message                                                  │
│  ) external {                                                               │
│    require(msg.sender == bridgeReceiver, "Only bridge receiver");           │
│                                                                             │
│    // Decode: (targetContract, resolutionData)                              │
│    (address targetContract, bytes memory data) =                            │
│      abi.decode(_message, (address, bytes));                                │
│                                                                             │
│    require(deployedBets[targetContract], "Unknown bet contract");           │
│                                                                             │
│    // Dispatch to BetCOFI                                                   │
│    BetCOFI(targetContract).setResolution(data);                             │
│                                                                             │
│    emit OracleResolutionReceived(targetContract, _sourceChainId);           │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Internal call: BetCOFI.setResolution()
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetCOFI.setResolution()                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  function setResolution(bytes calldata _message) external {                 │
│    require(msg.sender == factory, "Only factory can dispatch");             │
│                                                                             │
│    // Decode resolution data                                                │
│    (                                                                        │
│      address betAddress,        // "0x1234...5678"                         │
│      bool sideAWins,            // True                                     │
│      bool isUndetermined,       // False                                    │
│      uint256 timestamp,                                                     │
│      bytes32 txHash,                                                          │
│      uint256 priceValue,        // 0                                         │
│      string memory winnerVal    // "SIDE_A"                                 │
│    ) = abi.decode(_message, (address, bool, bool, uint256, bytes32,         │
│                               uint256, string));                            │
│                                                                             │
│    require(betAddress == address(this), "Response for wrong bet");          │
│    require(status == BetStatus.RESOLVING, "Not awaiting resolution");       │
│                                                                             │
│    // Update state                                                          │
│    uint8 oldStatus = uint8(status);                                         │
│    isResolved = true;                                                       │
│    isSideAWinner = sideAWins;  // True                                      │
│    resolvedPrice = priceValue;  // 0                                         │
│    winnerValue = winnerVal;     // "SIDE_A"                                 │
│                                                                             │
│    // Apply SCEM payout                                                    │
│    status = BetStatus.RESOLVED;                                             │
│    _applyScemPayout();                                                      │
│                                                                             │
│    // Notify factory                                                        │
│    IBetFactoryCOFI(factory).notifyStatusChange(oldStatus, uint8(RESOLVED)); │
│                                                                             │
│    emit BetResolved(sideAWins, block.timestamp, priceValue, winnerVal);     │
│    emit ResolutionReceived(sideAWins);                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ SCEM payout calculation
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetCOFI._applyScemPayout()                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  // Example trades:                                                         │
│  //                                                                         │
│  // Trader A: Side A, 100 USDC, probability 75                              │
│  // Trader B: Side A, 50 USDC, probability 60                               │
│  // Trader C: Side B, 80 USDC, probability 80                               │
│  // Trader D: Side B, 30 USDC, probability 50                               │
│  //                                                                         │
│  // Result: SIDE_A wins (isSideAWinner = true)                              │
│  //                                                                         │
│  // Pass 1: Calculate losers pool                                           │
│  losersPool = 80 + 30 = 110 USDC  (Trader C + D)                            │
│                                                                             │
│  // Calculate winner scores                                                 │
│  Trader A score: S(75, 100) = 2*75*100 - 75² = 15000 - 5625 = 9375          │
│  Trader B score: S(60, 100) = 2*60*100 - 60² = 12000 - 3600 = 8400          │
│                                                                             │
│  totalWeightedScore = (9375 * 100) + (8400 * 50)                            │
│                     = 937500 + 420000 = 1,357,500                           │
│                                                                             │
│  // Pass 2: Distribute payouts                                              │
│  Trader A share: (110 * 9375 * 100) / 1,357,500 = 75.93 USDC                │
│  Trader A payout: 100 + 75.93 = 175.93 USDC                                 │
│                                                                             │
│  Trader B share: (110 * 8400 * 50) / 1,357,500 = 34.07 USDC                 │
│  Trader B payout: 50 + 34.07 = 84.07 USDC                                   │
│                                                                             │
│  // Store in scemPayout mapping                                             │
│  scemPayout[TraderA] = 175.93 USDC                                          │
│  scemPayout[TraderB] = 84.07 USDC                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Events: BetResolved, ResolutionReceived
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Update UI                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Market status: RESOLVED                                                  │
│  - Winner: Side A ("Yes, FDA approval announced")                           │
│  - Show "Claim Winnings" button for winners                                 │
│  - Show AI Console with final consensus                                     │
│  - Update portfolio balances                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gas Cost: ~500K gas (SCEM calculation is expensive)

---

## Phase 6: Claiming

### Actors: All Traders

### Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Market Detail Page (RESOLVED state)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Winner clicks "Claim Winnings"
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEB3: Claim Call                                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│  const tx = await betContract.claim();                                      │
│  await tx.wait();                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Transaction submitted to Base Sepolia
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE SEPOLIA: BetCOFI.claim()                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  function claim() external nonReentrant {                                   │
│    require(isResolved, "Bet not resolved yet");                             │
│    require(!hasClaimed[msg.sender], "Already claimed");                     │
│                                                                             │
│    uint256 payout = 0;                                                      │
│                                                                             │
│    if (status == BetStatus.UNDETERMINED) {                                  │
│      // Refund full amount                                                  │
│      payout = betsOnSideA[msg.sender] + betsOnSideB[msg.sender];            │
│    } else if (status == BetStatus.RESOLVED) {                               │
│      // SCEM-weighted payout                                                │
│      payout = scemPayout[msg.sender];                                       │
│    }                                                                        │
│                                                                             │
│    require(payout > 0, "No winnings to claim");                             │
│                                                                             │
│    hasClaimed[msg.sender] = true;                                           │
│    require(token.transfer(msg.sender, payout), "Transfer failed");          │
│                                                                             │
│    emit WinningsClaimed(msg.sender, payout);                                │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ USDC transferred
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Update UI                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Show success toast: "Claimed 175.93 USDC!"                               │
│  - Disable claim button                                                     │
│  - Update wallet balance                                                    │
│  - Show transaction link                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gas Cost: ~100K gas

---

## Complete Event Log

```
Block 1001: BetCreated(marketAddress, creator, title, endDate)
Block 1050: BetPlaced(marketAddress, trader1, true, 100 USDC)
Block 1051: BetPlacedOnA(trader1, 100 USDC, 75)
Block 1100: BetPlaced(marketAddress, trader2, false, 80 USDC)
Block 1101: BetPlacedOnB(trader2, 80 USDC, 80)
...
Block 5000: ResolutionRequested(marketAddress, creator, NEWS, ...)
Block 5001: OracleResolutionReceived(marketAddress, 40245)
Block 5002: BetResolved(true, timestamp, 0, "SIDE_A")
Block 5003: ResolutionReceived(true)
Block 5010: WinningsClaimed(trader1, 175.93 USDC)
Block 5011: WinningsClaimed(trader2, 0)  # Loser claims 0
```

---

## Error Scenarios

### Scenario 1: UNDECIDED Consensus

```
GenLayer validators cannot reach consensus
→ decision = "UNDECIDED"
→ isUndetermined = true
→ status = UNDETERMINED
→ All traders claim full refund
→ No SCEM payout applied
```

### Scenario 2: Bridge Timeout

```
Oracle resolution takes > 7 days
→ Creator can call cancelBet()
→ status = UNDETERMINED
→ All traders claim full refund
```

### Scenario 3: Empty Evidence

```
Evidence URL returns empty/invalid content
→ _safe_fetch_text() returns ""
→ fetch_and_decide() returns "UNDECIDED"
→ Consensus: UNDECIDED
→ Full refunds
```

---

## Next Steps

- [SCEM Payout Mechanism](./05-scem.md) - Mathematical deep dive
- [AI Console](./06-ai-console.md) - Validator transparency guide
- [Deployment Guide](./07-deployment.md) - Deploy your own instance
