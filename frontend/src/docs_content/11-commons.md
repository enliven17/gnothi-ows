# The Commons — Group Coordination & Shared Capital

Gnothi implements **Track 04: The Commons** from the XMTP hackathon — enabling group coordination and shared capital for prediction markets.

---

## Overview

The Commons layer adds four interlocking features on top of the base prediction market protocol:

| Feature | Technology | Purpose |
|---------|------------|---------|
| **Group Chat** | XMTP v3 browser-sdk | Per-market group conversations |
| **MarketBot** | XMTP Agent (bridge service) | Automated notifications on key events |
| **USDC Onramp** | MoonPay signed-URL widget | Buy real stablecoins without a CEX |
| **Group Treasury** | GroupMarket.sol + OWS | Pool USDC and bet as a collective |

---

## 1. XMTP Group Chat

Every prediction market gets a dedicated XMTP group conversation identified by `gnothi:market:<contractId>`.

### Architecture

```
User connects wallet
    ↓
useMarketChat hook (frontend/src/lib/xmtp/useMarketChat.ts)
    ↓
getXmtpClient() — creates/restores XMTP client from EOA signer
    ↓
getOrCreateMarketGroup() — finds or creates group named "gnothi:market:<id>"
    ↓
loadMarketMessages() — loads last 50 messages
    ↓
streamMarketMessages() — real-time async-iterable stream
```

### Key Files

| File | Purpose |
|------|---------|
| [frontend/src/lib/xmtp/client.ts](../../../lib/xmtp/client.ts) | XMTP client singleton per wallet |
| [frontend/src/lib/xmtp/marketChat.ts](../../../lib/xmtp/marketChat.ts) | Group CRUD + message streaming |
| [frontend/src/lib/xmtp/useMarketChat.ts](../../../lib/xmtp/useMarketChat.ts) | React hook wiring it all together |
| [frontend/src/app/components/MarketChat/MarketChat.tsx](../../../app/components/MarketChat/MarketChat.tsx) | Chat UI component |

### XMTP Signer Pattern

Gnothi uses an **EOA signer** built from the user's wagmi wallet client:

```typescript
// Returns Uint8Array — required by XMTP v3
signMessage: async (message: string): Promise<Uint8Array> => {
  const sig = await walletClient.signMessage({ message });
  const hex = sig.startsWith('0x') ? sig.slice(2) : sig;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};
```

### Message Format

Messages are plain text strings. The chat UI distinguishes own vs. others' messages using `senderInboxId === xmtpClient.inboxId`.

---

## 2. MarketBot — XMTP Notification Agent

The bridge service runs an XMTP bot (`XMTP_BOT_PRIVATE_KEY`) that posts automated messages into every market group chat.

### Events Notified

| Event | Trigger | Message |
|-------|---------|---------|
| Market Created | `BetCreated` on-chain | "🚀 New market: `<title>`…" |
| Bet Placed | `BetPlaced` on-chain | "📊 New bet on `<market>`…" |
| Resolution Started | Oracle deployed to GenLayer | "⏳ AI validators are resolving…" |
| Validator Vote | GenLayer `ValidatorVoted` | "🤖 Validator `<N>` voted…" |
| Market Resolved | Bridge relay confirms | "✅ Market resolved: `<outcome>`…" |

### Key Files

| File | Purpose |
|------|---------|
| [bridge/service/src/xmtp/marketBot.ts](../../../bridge/service/src/xmtp/marketBot.ts) | Bot notification functions |
| [bridge/service/src/relay/EvmToGenLayer.ts](../../../bridge/service/src/relay/EvmToGenLayer.ts) | Calls `notifyResolutionStarted` |
| [bridge/service/src/relay/GenLayerToEvm.ts](../../../bridge/service/src/relay/GenLayerToEvm.ts) | Calls `notifyResolved` |

### Configuration

```env
# bridge/service/.env
XMTP_BOT_PRIVATE_KEY=0x...   # Separate EOA for the bot
```

---

## 3. MoonPay USDC Onramp

Users can buy USDC directly in the app without leaving to a CEX.

### Flow

```
User clicks "Buy USDC"
    ↓
frontend/src/lib/moonpay/onramp.ts
    ↓
GET /api/moonpay/sign?url=<unsigned_moonpay_url>
    ↓ (server-side HMAC-SHA256 with MOONPAY_SECRET_KEY)
Returns signed URL
    ↓
window.open(signedUrl) — MoonPay popup/tab
```

### API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/moonpay/sign` | Signs a MoonPay URL server-side (prevents key exposure) |
| `POST /api/moonpay/webhook` | Receives purchase completion events from MoonPay |

### Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_MOONPAY_API_KEY=pk_test_...   # Public key (safe to expose)
MOONPAY_SECRET_KEY=sk_test_...            # Secret key (server-side only)
MOONPAY_WEBHOOK_KEY=wk_test_...          # Webhook verification key
```

### Entry Points

The "Buy USDC" button appears:
- **Header** — inside the wallet balance dropdown
- **Market Chat** — below the chat input when wallet is connected

---

## 4. Group Treasury (GroupMarket.sol)

Multiple users can pool USDC into a shared on-chain vault and place bets collectively.

### Contract: `GroupMarket.sol`

Deployed at: `0x4E53468cF5FF43bd2bD2D7ECa657839566299724` (Base Sepolia)

```solidity
// Core functions
function deposit(uint256 amount) external          // Deposit USDC into the pool
function executeBet(address market, uint8 side,    // Pool places a bet
                    uint64 confidence) external
function receivePayout(address market) external    // Claim winnings into pool
function claimShare() external                     // Each member withdraws their share
function disband() external                        // Emergency: refund all members
```

### Proportional Payouts

Each member's share is proportional to their deposit:

```
userShare = totalPool × (userDeposit / totalDeposited)
```

### UI Component

The `GroupMarketPanel` appears on every market page (requires `NEXT_PUBLIC_GROUP_MARKET_ADDRESS`):

- Shows pool balance and member count
- Deposit form (USDC approve + deposit)
- Execute Bet button (owner only)
- Claim Share button (after resolution)

### Key Files

| File | Purpose |
|------|---------|
| [contracts/contracts/GroupMarket.sol](../../../contracts/GroupMarket.sol) | Shared treasury contract |
| [frontend/src/app/components/GroupMarket/GroupMarketPanel.tsx](../../../app/components/GroupMarket/GroupMarketPanel.tsx) | Group treasury UI |

---

## 5. OWS Wallet API

The app exposes an Open Wallet Standard-compatible API for agent skill integration.

### Routes

| Route | Purpose |
|-------|---------|
| `GET /api/ows/wallet` | List registered agent wallets |
| `POST /api/ows/wallet` | Create/retrieve an agent wallet |
| `GET /api/ows/credential?address=0x...` | Get prediction reputation credential |
| `POST /api/ows/credential` | Issue/update credential after resolution |

### Credential Schema

```typescript
interface MarketCredential {
  walletAddress: string;
  totalMarkets: number;
  correctPredictions: number;
  accuracyRate: number;   // 0–100
  totalStaked: string;    // USDC amount
  issuedAt: number;       // Unix ms
}
```

---

## Deployed Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| BetFactoryCOFI | `0xC2F959930D13d2796ceFaE4203E376c53f79fB98` |
| GroupMarket | `0x4E53468cF5FF43bd2bD2D7ECa657839566299724` |
| USDC (real) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## Track 04 Compliance Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| XMTP group messaging | ✅ | Per-market group chats |
| Multi-user coordination | ✅ | GroupMarket.sol treasury |
| Real stablecoins | ✅ | Base Sepolia USDC |
| OWS CLI / agent skill | ✅ | `/api/ows/*` routes |
| MoonPay agent skill | ✅ | Signed URL + webhook |
| MarketBot notifications | ✅ | Bridge service XMTP bot |
