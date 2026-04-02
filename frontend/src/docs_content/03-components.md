# Core Components

## Smart Contracts (EVM)

### BetFactoryCOFI.sol

**Purpose**: Factory contract for deploying prediction markets and routing oracle resolutions.

**Location**: `contracts/contracts/BetFactoryCOFI.sol`

#### Key State Variables

```solidity
address public immutable usdcToken;
address public bridgeReceiver;
address[] public allBets;
mapping(address => bool) public deployedBets;
mapping(address => bool) public approvedCreators;
mapping(address => bool) public approvedResolvers;

// Status tracking arrays
address[] public activeBets;
address[] public resolvingBets;
address[] public resolvedBets;
address[] public undeterminedBets;
```

#### Core Functions

##### `createNewsBet()`

```solidity
function createNewsBet(
    string memory title,
    string memory question,
    string memory evidenceUrl,
    string memory sideAName,
    string memory sideBName,
    uint256 endDate
) external returns (address)
```

**Parameters**:
- `title`: Human-readable market title
- `question`: The event question for AI validators
- `evidenceUrl`: Primary URL for evidence scraping
- `sideAName`: Label for "Yes" outcome
- `sideBName`: Label for "No" outcome
- `endDate`: Trading deadline (Unix timestamp)

**Returns**: `address` - Deployed BetCOFI contract address

**Events**: `BetCreated`

---

##### `placeBet()`

```solidity
function placeBet(
    address betAddress,
    bool onSideA,
    uint256 amount,
    uint8 probability
) external
```

**Parameters**:
- `betAddress`: Target market contract
- `onSideA`: `true` for Side A, `false` for Side B
- `amount`: USDC amount (in smallest units)
- `probability`: Confidence level 1-99 (for SCEM scoring)

**Requirements**:
- `probability >= 1 && probability <= 99`
- USDC approval required before calling

**Events**: `BetPlaced`

---

##### `processBridgeMessage()`

```solidity
function processBridgeMessage(
    uint32 _sourceChainId,
    address,
    bytes calldata _message
) external
```

**Called by**: `BridgeReceiver.sol`

**Decodes**: `(address targetContract, bytes memory data)`

**Calls**: `BetCOFI(targetContract).setResolution(data)`

**Events**: `OracleResolutionReceived`

---

##### `forwardResolutionRequest()`

```solidity
function forwardResolutionRequest(uint8 _resolutionType) external
```

**Called by**: `BetCOFI.resolve()`

**Emits**: `ResolutionRequested` event for bridge service to detect

**Event Data**:
```solidity
event ResolutionRequested(
    address indexed betContract,
    address indexed creator,
    uint8 resolutionType,
    string title,
    string sideAName,
    string sideBName,
    bytes resolutionData,
    uint256 timestamp
);
```

---

#### Access Control

```solidity
// Creator authorization
function canCreateBet(address _creator) public view returns (bool) {
    return _creator == owner() || approvedCreators[_creator];
}

// Resolver authorization
function canResolveBet(address _caller, address _creator) public view returns (bool) {
    return _caller == _creator || _caller == owner() || approvedResolvers[_caller];
}
```

---

### BetCOFI.sol

**Purpose**: Individual prediction market contract with SCEM-weighted payouts.

**Location**: `contracts/contracts/BetCOFI.sol`

#### Enums

```solidity
enum BetStatus { ACTIVE, RESOLVING, RESOLVED, UNDETERMINED }
enum ResolutionType { CRYPTO, STOCKS, NEWS }
```

#### Structs

```solidity
struct TradeSnapshot {
    address trader;
    uint8 probability;   // Confidence in own side (1–99)
    uint256 bondAmount;
    bool onSideA;
}
```

#### Key State Variables

```solidity
address public immutable creator;
string public title;
string public resolutionCriteria;
string public sideAName;
string public sideBName;
uint256 public immutable creationDate;
uint256 public immutable endDate;
address public immutable factory;
IERC20 public immutable token;
ResolutionType public immutable resolutionType;
bytes public resolutionData;

uint256 public totalSideA;
uint256 public totalSideB;
mapping(address => uint256) public betsOnSideA;
mapping(address => uint256) public betsOnSideB;

// SCEM
TradeSnapshot[] public trades;
mapping(address => uint256) public scemPayout;

// Resolution
bool public isResolved;
bool public isSideAWinner;
BetStatus public status;
uint256 public resolutionRequestedAt;
```

---

#### Betting Functions

##### `betOnSideAViaFactory()`

```solidity
function betOnSideAViaFactory(
    address bettor,
    uint256 amount,
    uint8 probability
) external
```

**Access**: Only BetFactoryCOFI

**Logic**:
1. Validates `probability` is 1-99
2. Updates `betsOnSideA[bettor] += amount`
3. Pushes `TradeSnapshot` to `trades` array
4. Emits `BetPlacedOnA`

---

##### `betOnSideBViaFactory()`

```solidity
function betOnSideBViaFactory(
    address bettor,
    uint256 amount,
    uint8 probability
) external
```

Same logic as Side A, but for Side B bets.

---

#### Resolution Functions

##### `resolve()`

```solidity
function resolve() external
```

**Access**: Creator, Owner, or Approved Resolver

**Requirements**:
- `block.timestamp >= endDate`
- `status == ACTIVE`

**Logic**:
1. `status = RESOLVING`
2. `resolutionRequestedAt = block.timestamp`
3. `factory.notifyStatusChange()`
4. `factory.forwardResolutionRequest(uint8(resolutionType))`

**Events**: `ResolutionRequested` (via factory)

---

##### `setResolution()`

```solidity
function setResolution(bytes calldata _message) external
```

**Access**: Only BetFactoryCOFI

**Decodes**:
```solidity
(
    address betAddress,
    bool sideAWins,
    bool isUndetermined,
    uint256 timestamp,
    bytes32 txHash,
    uint256 priceValue,
    string memory winnerVal
)
```

**Logic**:
1. Validates `betAddress == address(this)`
2. If `isUndetermined`:
   - `status = UNDETERMINED`
   - Emit `BetUndetermined`
3. Else:
   - `isResolved = true`
   - `isSideAWinner = sideAWins`
   - `status = RESOLVED`
   - `_applyScemPayout()`
   - Emit `BetResolved`
4. `factory.notifyStatusChange()`

---

#### SCEM Payout

##### `_applyScemPayout()`

```solidity
function _applyScemPayout() internal
```

**Algorithm**:

```solidity
// Quadratic Scoring Rule: S(r, q) = 2qr - q²
// Where r = 100 for winners, 0 for losers

// Pass 1: Calculate losers pool and total weighted score
for each trade:
    if trader on losing side:
        losersPool += bondAmount
    else:
        score = SCEMScoring.computeScore(probability, 100)
        totalWeightedScore += score * bondAmount

// Pass 2: Distribute payouts
for each winning trade:
    payout = bondAmount  // Return original bond
    if totalWeightedScore > 0:
        score = SCEMScoring.computeScore(probability, 100)
        share = (losersPool * score * bondAmount) / totalWeightedScore
        payout += share
    scemPayout[trader] += payout
```

**Edge Cases**:
- No winners on winning side → refund all traders
- Zero total weighted score → only bond returned

---

#### Claiming

##### `claim()`

```solidity
function claim() external nonReentrant
```

**Requirements**:
- `isResolved == true`
- `!hasClaimed[msg.sender]`

**Logic**:
- If `UNDETERMINED`: `payout = betsOnSideA + betsOnSideB`
- If `RESOLVED`: `payout = scemPayout[msg.sender]`
- Transfer USDC
- `hasClaimed[msg.sender] = true`

**Events**: `WinningsClaimed`

---

##### `getClaimableAmount()`

```solidity
function getClaimableAmount(address user) external view returns (uint256)
```

**Returns**: Current claimable amount for a user (0 if already claimed or unresolved)

---

#### Timeout & Cancellation

##### `cancelBet()`

```solidity
function cancelBet() external
```

**Access**: Only creator

**Requirements**:
- `status == RESOLVING`
- `block.timestamp >= resolutionRequestedAt + 7 days`

**Logic**:
- `status = UNDETERMINED`
- `isResolved = true`
- Emit `BetUndetermined`

**Purpose**: Recovery mechanism if oracle fails to respond

---

### SCEMScoring.sol

**Purpose**: Pure Solidity library for SCEM score calculation.

**Location**: `contracts/contracts/SCEMScoring.sol`

#### Core Function

```solidity
function computeScore(uint8 predictedProbability, uint8 realizedOutcome)
    internal pure returns (int256)
```

**Formula**: Quadratic Scoring Rule

```solidity
// S(r, q) = 2qr - q²
// Scaled to avoid decimals (× 100)

int256 q = int256(predictedProbability);
int256 r = int256(realizedOutcome);
return (2 * q * r - q * q) * 100;
```

**Properties**:
- Always positive for correct predictions (r = 100)
- Higher score for higher confidence (q)
- Maximum score at q = 100, r = 100

---

## Bridge Service (Node.js)

### EvmToGenLayer.ts

**Purpose**: Relay resolution requests from Base to GenLayer.

**Location**: `bridge/service/src/relay/EvmToGenLayer.ts`

#### Class Structure

```typescript
export class EvmToGenLayerRelay {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private genLayerClient: any;
  private processedEvents: Set<string>;
  private lastBlock: number;
  private pollInterval: NodeJS.Timeout | null;

  constructor();
  startListening(): void;
  stopListening(): void;
  private poll(): Promise<void>;
  private deployOracle(...): Promise<string | null>;
  private loadOracleCode(resolutionType: number): string;
}
```

#### Oracle Contract Mapping

```typescript
const ORACLE_CONTRACTS: Record<number, string> = {
  0: "crypto_prediction_market.py",  // CRYPTO
  1: "stock_prediction_market.py",   // STOCKS
  2: "news_pm.py",                   // NEWS
};
```

#### Deployment Logic

```typescript
private async deployOracle(
  betContract: string,
  resolutionType: number,
  title: string,
  sideAName: string,
  sideBName: string,
  resolutionData: string
): Promise<string | null> {
  // Decode resolution data
  const [tokenSymbol, tokenName] = decodeResolutionData(resolutionData);
  
  // For NEWS: tokenSymbol = question, tokenName = evidenceUrl
  const args = [
    betContract,      // market_id
    tokenSymbol,      // question (repurposed from token_symbol)
    tokenName,        // evidenceUrl (repurposed from token_name)
    title,
    sideAName,
    sideBName,
    bridgeSender,
    targetChainEid,
    targetContract
  ];

  // Load oracle code
  const code = this.loadOracleCode(resolutionType);

  // Deploy to GenLayer
  const hash = await this.genLayerClient.deployContract({
    code,
    args,
    leaderOnly: false,
  });

  // Record for AI Console
  await recordOracle(betContract, hash, oracleAddress);
}
```

#### Polling Mechanism

```typescript
private async poll(): Promise<void> {
  const currentBlock = await this.provider.getBlockNumber();
  
  // Query for ResolutionRequested events
  const events = await this.factoryContract.queryFilter(filter, fromBlock, toBlock);
  
  for (const event of events) {
    const [betContract, creator, resolutionType, title, sideAName, sideBName, resolutionData] = event.args;
    
    // Deploy oracle to GenLayer
    await this.deployOracle(betContract, resolutionType, title, sideAName, sideBName, resolutionData);
  }
}
```

---

### news_pm.py

**Purpose**: GenLayer oracle for NEWS market resolution.

**Location**: `bridge/intelligent-contracts/news_pm.py`

#### Contract Class

```python
class NewsPredictionMarket(gl.Contract):
    # Market identity
    market_id: str
    question: str
    evidence_url: str
    market_title: str
    side_a: str
    side_b: str
    
    # Resolution result
    decision: str  # "SIDE_A" | "SIDE_B" | "UNDECIDED"
    resolved_at: str
    
    # Bridge config
    bridge_sender: Address
    target_chain_eid: u256
    target_contract: str
```

#### Constructor

```python
def __init__(
    self,
    market_id: str,
    token_symbol: str,   # repurposed: carries the market question
    token_name: str,     # repurposed: carries the evidence URL
    market_title: str,
    side_a: str,
    side_b: str,
    bridge_sender: str,
    target_chain_eid: int,
    target_contract: str,
):
    # Store state
    self.market_id = market_id
    self.question = token_symbol
    self.evidence_url = token_name
    self.market_title = market_title
    self.side_a = side_a
    self.side_b = side_b
    self.bridge_sender = Address(bridge_sender)
    self.target_chain_eid = u256(target_chain_eid)
    self.target_contract = target_contract
    
    # Capture for closure
    question = self.question
    evidence_url = self.evidence_url
    
    # Non-deterministic AI consensus block
    def fetch_and_decide() -> str:
        # Fetch evidence
        web_content = _safe_fetch_text(evidence_url)
        truncated = web_content[:MAX_WEB_CHARS] if web_content else ""
        
        if not truncated.strip():
            return "UNDECIDED"
        
        # Build prompt
        prompt = f"""You are an objective fact-checker resolving a prediction market.

<question>{question}</question>
<evidence_url>{evidence_url}</evidence_url>
<evidence_text>
{truncated}
</evidence_text>

Side A label: "{side_a_name}"
Side B label: "{side_b_name}"

Instructions:
1. Read the evidence text carefully.
2. Decide whether the event described in <question> has occurred (SIDE_A wins),
   has not occurred / the opposite is true (SIDE_B wins), or the evidence is
   insufficient / ambiguous (UNDECIDED).
3. Output ONLY a JSON object with this exact key:
   {{"decision": "SIDE_A"}}    — if Side A wins
   {{"decision": "SIDE_B"}}    — if Side B wins
   {{"decision": "UNDECIDED"}} — if the evidence is unclear or insufficient
4. Do NOT include any explanation, markdown, or extra text.
5. IMPORTANT: The ONLY valid values for "decision" are the three strings above.
   Any other value is INVALID and must be replaced with "UNDECIDED"."""
        
        raw = _safe_prompt(prompt)
        return _extract_decision(raw)
    
    # Consensus
    self.decision = gl.eq_principle.strict_eq(fetch_and_decide)
    
    # Bridge result
    self._send_resolution_to_bridge()
```

#### Decision Extraction

```python
def _extract_decision(raw: str) -> str:
    """Parse LLM output and return normalized decision."""
    try:
        clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip())
        data = json.loads(clean)
        decision = str(data.get("decision", "UNDECIDED")).upper().strip()
        return decision if decision in VALID_DECISIONS else "UNDECIDED"
    except Exception:
        return "UNDECIDED"
```

**Valid Decisions**: `{"SIDE_A", "SIDE_B", "UNDECIDED"}`

---

#### Bridge Callback

```python
def _send_resolution_to_bridge(self):
    """Encode decision and forward to EVM via BridgeSender."""
    side_a_wins = (self.decision == "SIDE_A")
    is_undetermined = (self.decision == "UNDECIDED")
    timestamp = int(datetime.now().timestamp())
    tx_hash = bytes(32)
    
    # Encode resolution data
    resolution_abi = [Address, bool, bool, u256, bytes, u256, str]
    resolution_encoder = genvm_eth.MethodEncoder("", resolution_abi, bool)
    resolution_data = resolution_encoder.encode_call([
        Address(self.market_id),
        side_a_wins,
        is_undetermined,
        u256(timestamp),
        tx_hash,
        u256(0),           # price = 0
        self.decision,     # winning side label
    ])[4:]
    
    # Wrap for BetFactoryCOFI.processBridgeMessage
    wrapper_abi = [Address, bytes]
    wrapper_encoder = genvm_eth.MethodEncoder("", wrapper_abi, bool)
    message_bytes = wrapper_encoder.encode_call([
        Address(self.market_id),
        resolution_data,
    ])[4:]
    
    # Send via LayerZero
    bridge = gl.get_contract_at(self.bridge_sender)
    bridge.emit().send_message(
        self.target_chain_eid,
        self.target_contract,
        message_bytes,
    )
```

---

## Frontend Components

### AIConsole Component

**Purpose**: Display real-time GenLayer validator progress.

**Location**: `frontend/src/app/components/AIConsole/AIConsole.tsx`

#### Props

```typescript
interface AIConsoleProps {
  marketId: string;
  status: 'ACTIVE' | 'RESOLVING' | 'RESOLVED' | 'UNDETERMINED';
}
```

#### Polling Logic

```typescript
// hooks/useAIConsole.ts
export function useAIConsole(marketId: string, status: string) {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [consensus, setConsensus] = useState<string | null>(null);
  
  useEffect(() => {
    if (status !== 'RESOLVING') return;
    
    const pollInterval = setInterval(async () => {
      // Fetch GenLayer tx hash from bridge service
      const response = await fetch(`/api/oracle/tx/${marketId}`);
      const { txHash } = await response.json();
      
      // Poll GenLayer for tx status
      const tx = await genlayer.getTransactionByHash(txHash);
      
      // Extract validator decisions
      setValidators(tx.validators);
      setConsensus(tx.consensus);
      
      if (tx.status === 'FINALIZED') {
        clearInterval(pollInterval);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [marketId, status]);
  
  return { txHash, validators, consensus };
}
```

#### UI Display

```tsx
// AIConsole.tsx
<div className="ai-console">
  <h3>AI Oracle Resolution</h3>
  
  <div className="validator-grid">
    {validators.map((v, i) => (
      <div key={i} className="validator-card">
        <div className="validator-name">Agent {i + 1}</div>
        <div className="validator-status">
          {v.status === 'ACCEPTED' ? '✓' : '⚠'}
        </div>
        <div className="validator-decision">
          {v.decision || 'Scanning...'}
        </div>
      </div>
    ))}
  </div>
  
  <div className="consensus-banner">
    {consensus ? (
      <span className={consensus}>
        Consensus: {consensus} {consensus !== 'UNDECIDED' ? '✅' : '⏳'}
      </span>
    ) : (
      <span>Waiting for consensus...</span>
    )}
  </div>
</div>
```

---

### CreateMarketModal

**Purpose**: Admin interface for creating NEWS markets.

**Location**: `frontend/src/app/components/CreateMarketModal/CreateMarketModal.tsx`

#### Form Fields

```typescript
interface CreateMarketForm {
  title: string;
  question: string;
  evidenceUrl: string;
  sideAName: string;
  sideBName: string;
  endDate: string;  // ISO date string
}
```

#### Validation

```typescript
function validateForm(form: CreateMarketForm): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!form.question.trim()) {
    errors.push({ field: 'question', message: 'Question is required' });
  }
  
  if (!form.evidenceUrl.trim()) {
    errors.push({ field: 'evidenceUrl', message: 'Evidence URL is required' });
  } else if (!isValidUrl(form.evidenceUrl)) {
    errors.push({ field: 'evidenceUrl', message: 'Invalid URL format' });
  }
  
  if (!form.sideAName.trim()) {
    errors.push({ field: 'sideAName', message: 'Side A name is required' });
  }
  
  if (!form.sideBName.trim()) {
    errors.push({ field: 'sideBName', message: 'Side B name is required' });
  }
  
  const endDate = new Date(form.endDate);
  if (endDate <= new Date()) {
    errors.push({ field: 'endDate', message: 'End date must be in the future' });
  }
  
  return errors;
}
```

#### Contract Call

```typescript
async function createNewsMarket(form: CreateMarketForm) {
  const factory = getBetFactoryContract();
  
  const endDateUnix = Math.floor(new Date(form.endDate).getTime() / 1000);
  
  const tx = await factory.createNewsBet(
    form.title,
    form.question,
    form.evidenceUrl,
    form.sideAName,
    form.sideBName,
    endDateUnix
  );
  
  await tx.wait();
  
  return tx.hash;
}
```

---

## Configuration

### Environment Variables

#### Contracts (.env)

```bash
# Contracts
PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
MOCK_USDL_ADDRESS=0x...  # For testing
```

#### Frontend (.env.local)

```bash
NEXT_PUBLIC_BET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_BRIDGE_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_OWNER_ADDRESS=0x...
NEXT_PUBLIC_PRIVY_APP_ID=...
```

#### Bridge Service (.env)

```bash
# Core
PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BET_FACTORY_ADDRESS=0x...
GENLAYER_RPC_URL=https://rpc.genlayer.net
BRIDGE_SENDER_ADDRESS=0x...

# Optional
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
HTTP_PORT=3001
```

---

## Next Steps

- [SCEM Payout Mechanism](./05-scem.md) - Deep dive into scoring mathematics
- [AI Console](./06-ai-console.md) - Validator transparency documentation
- [Deployment Guide](./07-deployment.md) - Step-by-step deployment
