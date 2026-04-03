# Bridge Service

This service handles two jobs:

- `EVM -> GenLayer`: listens for `ResolutionRequested` on Base and deploys the matching oracle
- `GenLayer -> EVM`: relays GenLayer bridge messages back to the Base-side receiver

It also exposes an HTTP API for scheduled resolutions and AI console metadata.

## OWS Integration

The bridge service uses **Open Wallet Standard** (`@open-wallet-standard/core`) for all relay transaction signing on Railway/Linux.

### How it works

On startup the service:
1. Imports `CALLER_PRIVATE_KEY` into an encrypted OWS vault (`~/.ows-vault/` by default)
2. Registers a chain-allowlist policy: only `eip155:300` (zkSync Sepolia) and `eip155:84532` (Base Sepolia) are permitted
3. Creates an `OWSEthersWallet` signer — a drop-in `ethers.AbstractSigner` backed by OWS

Every relay and resolution transaction is then signed via OWS:
- Key is decrypted only during signing
- Key material is wiped from memory after use
- Private key is never exposed as a raw value at runtime

On Windows (local dev) the native binding is unavailable; the signer transparently falls back to `ethers.Wallet`. No code changes are needed.

### Files

| File | Role |
|------|------|
| `src/ows/OWSVault.ts` | Vault lifecycle, policy registration, `OWSEthersWallet`, `createOWSSigningWallet()` |
| `src/index.ts` | Calls `initOWSVault()` on startup before relay classes are created |

## Required Environment

Core:

- `PRIVATE_KEY`: wallet used for scheduled `resolve()` calls and GenLayer deployment
- `CALLER_PRIVATE_KEY`: relay wallet with `CALLER_ROLE` on `BridgeForwarder` — imported into OWS vault on startup
- `BASE_SEPOLIA_RPC_URL`: Base Sepolia RPC endpoint
- `BET_FACTORY_ADDRESS`: deployed `BetFactoryCOFI` address
- `GENLAYER_RPC_URL`: GenLayer RPC endpoint
- `BRIDGE_SENDER_ADDRESS`: GenLayer-side bridge sender address

GenLayer -> EVM relay:

- `BRIDGE_FORWARDER_ADDRESS`
- `FORWARDER_NETWORK_RPC_URL`

HTTP API:

- `HTTP_PORT` or platform `PORT`

Optional:

- `OWS_VAULT_PATH`: override OWS vault directory (default: `~/.ows-vault`)
- `BRIDGE_SYNC_INTERVAL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ORACLES_PATH`

## Persistence Modes

### Local mode

If Supabase is not configured:

- oracle deployments are stored in memory
- resolution jobs are stored in `bridge/service/resolution-queue.json`

This is enough for local development, but oracle tx metadata is lost on restart.

### Persistent mode

If `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are configured:

- `oracle_deployments` stores `contract_address -> tx_hash -> oracle_address`
- `resolution_jobs` stores pending and completed scheduled resolution jobs

Schema is defined in [001_initial.sql](/c:/Users/enliven/Documents/GitHub/gnothi/supabase/migrations/001_initial.sql).

## API Endpoints

- `GET /health`
- `POST /resolution/schedule`
- `GET /resolution/queue`
- `GET /resolution/job/:id`
- `DELETE /resolution/job/:id`
- `GET /oracle/tx/:contractAddress`

The frontend uses `/oracle/tx/:contractAddress` to retrieve the GenLayer deployment tx hash for the AI console.

## NEWS Flow

1. `BetCOFI.resolve()` emits `ResolutionRequested` through the factory.
2. `EvmToGenLayer.ts` decodes `resolutionData`.
3. For NEWS markets it interprets the two encoded strings as:
   - first string: `question`
   - second string: `evidenceUrl`
4. `news_pm.py` is deployed to GenLayer.
5. `recordOracle()` stores the tx hash so the frontend can poll validator progress.
6. The oracle sends the result back through the bridge.

## Commands

```bash
npm install
npm run build
npm run dev
```

Useful scripts:

```bash
npm run sync:news-oracle
npm run test:oracle
npm run test:e2e
npm run test:e2e:news
```
