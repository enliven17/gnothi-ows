# Deployment Guide

## Prerequisites

### Required Software

- **Node.js**: v18+ (v20 recommended)
- **npm**: v9+
- **Python**: v3.10+ (for GenLayer contracts)
- **Git**: For cloning repositories

### Required Accounts & Keys

- **EVM Wallet**: MetaMask or similar with Base Sepolia ETH
- **GenLayer Account**: For oracle deployment
- **LayerZero**: For cross-chain messaging (configured via bridge)
- **Supabase** (optional): For persistent oracle metadata

### Network Access

| Network | RPC URL | Chain ID | Faucet |
|---------|---------|----------|--------|
| Base Sepolia | `https://sepolia.base.org` | 84532 | [Coinbase Faucet](https://faucet.coinbase.com/) |
| GenLayer Bradbury | `https://rpc.genlayer.net` | 18881 | [GenLayer Faucet](https://faucet.genlayer.net/) |

---

## Phase 1: Smart Contracts Deployment

### Step 1: Clone Repository

```bash
git clone https://github.com/enliven17/gnothi.git
cd gnothi
```

### Step 2: Install Dependencies

```bash
# Contracts
cd contracts
npm install

# Frontend
cd ../frontend
npm install

# Bridge Service
cd ../bridge/service
npm install
```

### Step 3: Configure Environment

Create `contracts/.env`:

```bash
# Private key for deployment (DO NOT use mainnet key!)
PRIVATE_KEY=0xyour_private_key_here

# Base Sepolia RPC
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Mock USDC for testing (optional)
MOCK_USDL_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Step 4: Compile Contracts

```bash
cd contracts
npm run compile
```

**Expected Output**:
```
Compiled 15 Solidity files successfully
```

### Step 5: Deploy to Base Sepolia

```bash
npm run deploy
```

Or manually:

```bash
npx hardhat run scripts/deploy-factory.ts --network baseSepolia
```

**Expected Output**:
```
Deploying BetFactoryCOFI...
BetFactoryCOFI deployed to: 0x1234...5678
Deploying BridgeReceiver...
BridgeReceiver deployed to: 0xabcd...efgh

Deployment complete!
Save these addresses to frontend/.env.local
```

### Step 6: Save Deployed Addresses

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_BET_FACTORY_ADDRESS=0x1234...5678
NEXT_PUBLIC_BRIDGE_RECEIVER_ADDRESS=0xabcd...efgh
NEXT_PUBLIC_OWNER_ADDRESS=0xyour_wallet_address
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
```

---

## Phase 2: Bridge Service Setup

### Step 1: Configure Environment

Create `bridge/service/.env`:

```bash
# Core Configuration
PRIVATE_KEY=0xyour_private_key_here
CALLER_PRIVATE_KEY=0xyour_relay_wallet_key   # Must have CALLER_ROLE on BridgeForwarder
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BET_FACTORY_ADDRESS=0x1234...5678
GENLAYER_RPC_URL=https://rpc.genlayer.net
BRIDGE_SENDER_ADDRESS=0x9876...5432

# Bridge Forwarder (GenLayer → EVM)
BRIDGE_FORWARDER_ADDRESS=0xfwd...addr
FORWARDER_NETWORK_RPC_URL=https://forwarder.genlayer.net

# HTTP API
HTTP_PORT=3001

# OWS Vault (optional — Railway: set to a mounted volume path)
# OWS_VAULT_PATH=/data/.ows-vault

# Supabase — required for OWS credential persistence
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Optional: Oracle path override
ORACLES_PATH=./intelligent-oracles
```

### Step 1b: Grant CALLER_ROLE to Relay Wallet

If you are using a separate `CALLER_PRIVATE_KEY` (recommended), grant it `CALLER_ROLE` on the BridgeForwarder:

```bash
cd bridge/smart-contracts
NEW_CALLER=0xyour_relay_wallet_address \
  npx hardhat run scripts/set-caller.ts --network zkSyncSepoliaTestnet
```

### Step 1c: Create OWS Credentials Table (Supabase)

Run in the Supabase SQL editor to enable reputation credential persistence:

```sql
CREATE TABLE IF NOT EXISTS ows_credentials (
  wallet_address      TEXT PRIMARY KEY,
  total_markets       INT NOT NULL DEFAULT 0,
  correct_predictions INT NOT NULL DEFAULT 0,
  accuracy_rate       FLOAT NOT NULL DEFAULT 0,
  total_staked        TEXT NOT NULL DEFAULT '0',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Step 2: Build Bridge Service

```bash
cd bridge/service
npm run build
```

### Step 3: Start Bridge Service

```bash
npm run dev
```

**Expected Output**:
```
Starting Bridge Service

[OWS] Vault: relay-wallet imported — EVM 0x83CC...1646
[OWS] Policy: relay-chain-allowlist registered (chains: eip155:300, eip155:84532)
[OWS] Vault initialized — native SDK active
[OWS] Signing wallet created — OWS-backed (0x83CC...1646)

[GL→EVM] Initializing...
[EVM→GL] Starting event polling (every 5s)...
[RESOLUTION] HTTP API listening on port 3001
```

On Windows (local dev), OWS native is unavailable — you will see:
```
[OWS] Native bindings unavailable (Windows dev mode) — ethers.js fallback active
```
This is expected. All signing continues via `ethers.Wallet`.

### Step 4: Verify Bridge Service

```bash
curl http://localhost:3001/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```

---

## Phase 3: Frontend Setup

### Step 1: Configure Environment

Create `frontend/.env.local` (complete):

```bash
# Contract Addresses
NEXT_PUBLIC_BET_FACTORY_ADDRESS=0x1234...5678
NEXT_PUBLIC_BRIDGE_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_OWNER_ADDRESS=0xyour_wallet_address

# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# GenLayer (for AI Console)
NEXT_PUBLIC_GENLAYER_RPC_URL=https://rpc.genlayer.net

# Optional: Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 2: Sync Contract Artifacts

```bash
cd frontend
npm run sync-abis
```

This copies ABI files from `contracts/artifacts` to `frontend/src/lib/contracts`.

### Step 3: Start Development Server

```bash
npm run dev
```

**Expected Output**:
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Step 4: Open in Browser

Navigate to: `http://localhost:3000`

---

## Phase 4: GenLayer Oracle Deployment

### Step 1: Verify Oracle Contract

```bash
cat bridge/intelligent-contracts/news_pm.py
```

**Expected Content**:
```python
# { "Depends": "py-genlayer:latest" }
"""
NewsOracle: Resolves news-based prediction markets via AI consensus.
"""

import json
import re
from datetime import datetime

from genlayer import *
# ... rest of the oracle code
```

### Step 2: Test Oracle Locally (Optional)

```bash
cd bridge/service
npm run test:oracle
```

### Step 3: Deploy Oracle Manually (Testing)

```bash
cd bridge/service
npm run deploy-oracle -- \
  --market-id 0xTestMarket \
  --question "Test question?" \
  --evidence-url "https://example.com/evidence" \
  --side-a "Yes" \
  --side-b "No"
```

---

## Phase 5: End-to-End Testing

### Step 1: Create Test Market

1. Open `http://localhost:3000/admin`
2. Connect wallet
3. Fill form:
   - **Title**: "Test Market"
   - **Question**: "Will the test succeed?"
   - **Evidence URL**: `https://example.com`
   - **Side A**: "Yes"
   - **Side B**: "No"
   - **End Date**: 5 minutes from now
4. Click "Create Market"

### Step 2: Place Test Bets

1. Navigate to market detail page
2. Connect wallet
3. Approve USDC spending
4. Place bet:
   - **Side**: A
   - **Amount**: 10 USDC
   - **Confidence**: 75%
5. Confirm transaction

### Step 3: Trigger Resolution

Wait for end date, then:

1. Click "Resolve Market"
2. Confirm transaction

### Step 4: Monitor Bridge Service

Check bridge service logs:

```bash
# In bridge/service terminal
[EVM→GL] *** ResolutionRequested ***
  Bet: 0xTestMarket
  Type: NEWS (2)
  Title: Test Market
  
[EVM→GL] Deploying oracle...
[EVM→GL] Deploy TX: 0xGenLayerTx...
[EVM→GL] Oracle deployed: 0xOracleAddr...
```

### Step 5: Watch AI Console

1. Navigate to market detail page
2. Scroll to "AI Oracle Resolution" section
3. Watch validators reach consensus (~2-5 minutes)

### Step 6: Claim Winnings

After resolution:

1. Click "Claim Winnings"
2. Confirm transaction
3. Receive USDC payout

---

## Production Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

**Environment Variables**:
```bash
NEXT_PUBLIC_BET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_BRIDGE_SERVICE_URL=https://bridge.yourdomain.com
NEXT_PUBLIC_GENLAYER_RPC_URL=https://rpc.genlayer.net
```

### Bridge Service (Railway)

1. Push code to GitHub
2. Create new service in Railway
3. Set root directory: `bridge/service`
4. Configure environment variables
5. Deploy

**Railway Environment Variables**:
```bash
PRIVATE_KEY=${RAILWAY_PRIVATE_KEY}
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BET_FACTORY_ADDRESS=0x...
GENLAYER_RPC_URL=https://rpc.genlayer.net
HTTP_PORT=${PORT}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
```

### Supabase Database

Create tables:

```sql
-- oracle_deployments
CREATE TABLE oracle_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address TEXT NOT NULL UNIQUE,
  tx_hash TEXT NOT NULL,
  oracle_address TEXT NOT NULL,
  deployed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_deployments_contract ON oracle_deployments(contract_address);

-- resolution_jobs
CREATE TABLE resolution_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_resolution_jobs_market ON resolution_jobs(market_id);
CREATE INDEX idx_resolution_jobs_status ON resolution_jobs(status);
```

---

## Configuration Reference

### Contract Addresses

| Network | BetFactoryCOFI | BridgeReceiver | USDC |
|---------|----------------|----------------|------|
| Base Sepolia (Test) | Deploy on setup | Deploy on setup | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base Mainnet (Prod) | Deploy on setup | Deploy on setup | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### LayerZero EIDs

| Network | EID |
|---------|-----|
| Base Sepolia | 40245 |
| Base Mainnet | 30184 |
| GenLayer Bradbury | Configure per deployment |

### Gas Estimates

| Operation | Gas Cost | USD Cost (Base Sepolia) |
|-----------|----------|------------------------|
| Deploy BetFactory | ~2,000,000 | ~$0.50 |
| Create Market | ~500,000 | ~$0.10 |
| Place Bet | ~150,000 | ~$0.03 |
| Resolve Market | ~200,000 | ~$0.05 |
| Set Resolution | ~500,000 | ~$0.10 |
| Claim Winnings | ~100,000 | ~$0.02 |

---

## Troubleshooting

### Issue: "Cannot read properties of undefined"

**Cause**: Contract ABIs not synced.

**Solution**:
```bash
cd frontend
npm run sync-abis
```

---

### Issue: "Bridge service not responding"

**Cause**: Bridge service not running or wrong port.

**Solution**:
```bash
cd bridge/service
npm run dev
# Check HTTP_PORT in .env matches frontend config
```

---

### Issue: "Oracle deployment fails"

**Cause**: Invalid GenLayer RPC or insufficient funds.

**Solution**:
1. Check `GENLAYER_RPC_URL` in `.env`
2. Ensure wallet has GenLayer test tokens
3. Verify oracle contract syntax:
   ```bash
   python -m py_compile bridge/intelligent-contracts/news_pm.py
   ```

---

### Issue: "AI Console shows no validators"

**Cause**: Transaction not yet picked up by GenLayer.

**Solution**: Wait 1-2 minutes. Polling continues automatically.

---

## Security Checklist

- [ ] Use separate deployment wallet (not mainnet)
- [ ] Store private keys in secure vault (not in code)
- [ ] Enable rate limiting on bridge service API
- [ ] Configure CORS for production domains only
- [ ] Use HTTPS for all production endpoints
- [ ] Set up monitoring and alerting
- [ ] Regular security audits for smart contracts
- [ ] Implement emergency pause mechanism

---

## Next Steps

- [API Reference](./08-api.md) - Complete bridge service API documentation
- [Troubleshooting](./09-troubleshooting.md) - Common issues and solutions
- [Contributing](./10-contributing.md) - How to contribute to Gnothi
