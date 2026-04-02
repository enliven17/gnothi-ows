# API Reference

## Bridge Service HTTP API

Base URL: `http://localhost:3001` (development) or `https://bridge.yourdomain.com` (production)

---

## Health & Status

### GET `/health`

Check if the bridge service is running.

**Request**:
```bash
curl http://localhost:3001/health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2025-12-31T12:00:00.000Z",
  "uptime": 3600
}
```

---

### GET `/status`

Get detailed service status including connected networks.

**Request**:
```bash
curl http://localhost:3001/status
```

**Response** (200 OK):
```json
{
  "evm": {
    "connected": true,
    "network": "Base Sepolia",
    "chainId": 84532,
    "lastBlock": 12345678,
    "factoryAddress": "0x1234...5678"
  },
  "genlayer": {
    "connected": true,
    "network": "Bradbury Testnet",
    "chainId": 18881,
    "bridgeSenderAddress": "0x9876...5432"
  },
  "relay": {
    "running": true,
    "eventsProcessed": 42,
    "oraclesDeployed": 15
  }
}
```

---

## Oracle Endpoints

### GET `/oracle/tx/:contractAddress`

Get GenLayer deployment transaction for a market's oracle.

**Parameters**:
- `contractAddress` (path): BetCOFI market contract address

**Request**:
```bash
curl http://localhost:3001/oracle/tx/0xMarketAddress
```

**Response** (200 OK):
```json
{
  "txHash": "0xGenLayerTxHash...",
  "oracleAddress": "0xOracleContractAddress...",
  "deployedAt": "2025-12-31T12:30:00.000Z"
}
```

**Response** (404 Not Found):
```json
{
  "error": "Oracle deployment not found"
}
```

**Use Case**: Frontend AI Console polls this endpoint to get the GenLayer tx hash for monitoring.

---

### GET `/oracle/:contractAddress`

Get detailed oracle information including resolution status.

**Parameters**:
- `contractAddress` (path): BetCOFI market contract address

**Request**:
```bash
curl http://localhost:3001/oracle/0xMarketAddress
```

**Response** (200 OK):
```json
{
  "oracleAddress": "0xOracleContractAddress...",
  "txHash": "0xGenLayerTxHash...",
  "status": "DEPLOYED" | "RESOLVING" | "RESOLVED" | "FAILED",
  "decision": "SIDE_A" | "SIDE_B" | "UNDECIDED" | null,
  "deployedAt": "2025-12-31T12:30:00.000Z",
  "resolvedAt": "2025-12-31T12:35:00.000Z",
  "validators": [
    {
      "id": 1,
      "status": "ACCEPTED",
      "decision": "SIDE_A",
      "stake": "1000000"
    }
  ]
}
```

---

### POST `/oracle/deploy`

Manually trigger oracle deployment for a market.

**Request Body**:
```json
{
  "marketAddress": "0xMarketAddress...",
  "resolutionType": "NEWS",
  "question": "Will the event occur?",
  "evidenceUrl": "https://example.com/evidence",
  "sideAName": "Yes",
  "sideBName": "No",
  "title": "Test Market"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "txHash": "0xGenLayerTxHash...",
  "oracleAddress": "0xOracleContractAddress..."
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Invalid resolution type",
  "details": "Resolution type must be CRYPTO, STOCKS, or NEWS"
}
```

---

## Resolution Queue

### GET `/resolution/queue`

Get list of pending resolution jobs.

**Request**:
```bash
curl http://localhost:3001/resolution/queue
```

**Response** (200 OK):
```json
{
  "pending": [
    {
      "id": "job-uuid-1",
      "marketAddress": "0xMarket1...",
      "resolutionType": "NEWS",
      "createdAt": "2025-12-31T12:00:00.000Z",
      "status": "pending"
    }
  ],
  "processing": [
    {
      "id": "job-uuid-2",
      "marketAddress": "0xMarket2...",
      "resolutionType": "NEWS",
      "createdAt": "2025-12-31T11:55:00.000Z",
      "status": "deploying_oracle"
    }
  ],
  "completed": [
    {
      "id": "job-uuid-3",
      "marketAddress": "0xMarket3...",
      "resolutionType": "NEWS",
      "createdAt": "2025-12-31T11:50:00.000Z",
      "completedAt": "2025-12-31T11:55:00.000Z",
      "status": "completed",
      "result": "SIDE_A"
    }
  ]
}
```

---

### POST `/resolution/schedule`

Schedule a market for resolution (alternative to automatic trigger).

**Request Body**:
```json
{
  "marketAddress": "0xMarketAddress...",
  "executeAt": "2025-12-31T23:59:59.000Z"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "jobId": "job-uuid-...",
  "scheduledFor": "2025-12-31T23:59:59.000Z"
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Market is not in RESOLVING status"
}
```

---

### GET `/resolution/job/:jobId`

Get status of a specific resolution job.

**Parameters**:
- `jobId` (path): Resolution job UUID

**Request**:
```bash
curl http://localhost:3001/resolution/job/job-uuid-...
```

**Response** (200 OK):
```json
{
  "id": "job-uuid-...",
  "marketAddress": "0xMarket...",
  "status": "pending" | "processing" | "completed" | "failed",
  "createdAt": "2025-12-31T12:00:00.000Z",
  "completedAt": "2025-12-31T12:05:00.000Z",
  "result": {
    "decision": "SIDE_A",
    "oracleTxHash": "0xGenLayerTx...",
    "oracleAddress": "0xOracle..."
  },
  "error": null
}
```

---

### DELETE `/resolution/job/:jobId`

Cancel a pending resolution job.

**Parameters**:
- `jobId` (path): Resolution job UUID

**Request**:
```bash
curl -X DELETE http://localhost:3001/resolution/job/job-uuid-...
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Resolution job cancelled"
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Cannot cancel completed job"
}
```

---

## Event Endpoints

### GET `/events/resolution-requested`

Get recent `ResolutionRequested` events.

**Query Parameters**:
- `fromBlock` (optional): Start block number
- `toBlock` (optional): End block number
- `limit` (optional): Max results (default: 50)

**Request**:
```bash
curl "http://localhost:3001/events/resolution-requested?fromBlock=12340000&limit=10"
```

**Response** (200 OK):
```json
{
  "events": [
    {
      "blockNumber": 12345678,
      "transactionHash": "0xTxHash...",
      "betContract": "0xMarket...",
      "creator": "0xCreator...",
      "resolutionType": "NEWS",
      "title": "Will the FDA approve Drug X?",
      "sideAName": "Yes",
      "sideBName": "No",
      "resolutionData": "0xEncodedData...",
      "timestamp": 1704067200
    }
  ]
}
```

---

### GET `/events/bet-created`

Get recent `BetCreated` events.

**Query Parameters**:
- `creator` (optional): Filter by creator address
- `limit` (optional): Max results (default: 50)

**Request**:
```bash
curl "http://localhost:3001/events/bet-created?creator=0xCreator...&limit=20"
```

**Response** (200 OK):
```json
{
  "events": [
    {
      "blockNumber": 12345678,
      "transactionHash": "0xTxHash...",
      "betAddress": "0xMarket...",
      "creator": "0xCreator...",
      "title": "Market Title",
      "endDate": 1704153600
    }
  ]
}
```

---

### GET `/events/bet-placed`

Get recent `BetPlaced` events for a market.

**Query Parameters**:
- `betAddress` (required): Market contract address
- `limit` (optional): Max results (default: 100)

**Request**:
```bash
curl "http://localhost:3001/events/bet-placed?betAddress=0xMarket...&limit=50"
```

**Response** (200 OK):
```json
{
  "events": [
    {
      "blockNumber": 12345680,
      "transactionHash": "0xTxHash...",
      "betAddress": "0xMarket...",
      "bettor": "0xBettor...",
      "onSideA": true,
      "amount": "100000000",
      "probability": 75
    }
  ]
}
```

---

## Admin Endpoints

### POST `/admin/approve-creator`

Approve an address to create markets.

**Authentication**: Requires `Authorization: Bearer <admin-token>`

**Request Body**:
```json
{
  "creatorAddress": "0xCreator...",
  "approved": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "transactionHash": "0xTxHash...",
  "message": "Creator approval updated"
}
```

---

### POST `/admin/approve-resolver`

Approve an address to resolve markets.

**Authentication**: Requires `Authorization: Bearer <admin-token>`

**Request Body**:
```json
{
  "resolverAddress": "0xResolver...",
  "approved": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "transactionHash": "0xTxHash...",
  "message": "Resolver approval updated"
}
```

---

### POST `/admin/set-bridge-receiver`

Update the bridge receiver contract address.

**Authentication**: Requires `Authorization: Bearer <admin-token>`

**Request Body**:
```json
{
  "bridgeReceiverAddress": "0xBridgeReceiver..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "transactionHash": "0xTxHash...",
  "oldReceiver": "0xOldReceiver...",
  "newReceiver": "0xBridgeReceiver..."
}
```

---

## WebSocket Endpoints

### `ws://localhost:3001/ws`

Subscribe to real-time events.

**Connection**:
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = () => {
  // Subscribe to specific event types
  ws.send(JSON.stringify({
    action: 'subscribe',
    channels: ['resolution-requested', 'oracle-deployed', 'resolution-completed']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Event Types**:

```json
// Resolution Requested
{
  "type": "resolution-requested",
  "data": {
    "marketAddress": "0xMarket...",
    "resolutionType": "NEWS",
    "timestamp": 1704067200
  }
}

// Oracle Deployed
{
  "type": "oracle-deployed",
  "data": {
    "marketAddress": "0xMarket...",
    "txHash": "0xGenLayerTx...",
    "oracleAddress": "0xOracle..."
  }
}

// Resolution Completed
{
  "type": "resolution-completed",
  "data": {
    "marketAddress": "0xMarket...",
    "decision": "SIDE_A",
    "timestamp": 1704067500
  }
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_INPUT` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

| Endpoint | Rate Limit |
|----------|------------|
| `/health`, `/status` | 60 req/min |
| `/oracle/*` | 30 req/min |
| `/resolution/*` | 20 req/min |
| `/events/*` | 30 req/min |
| `/admin/*` | 10 req/min |
| `/ws` | 5 connections/IP |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1704067260
```

**Response** (429 Too Many Requests):
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## SDK Usage

### TypeScript Client

```typescript
// frontend/src/lib/bridgeApi.ts

const BRIDGE_SERVICE_URL = process.env.NEXT_PUBLIC_BRIDGE_SERVICE_URL;

export interface OracleDeployment {
  txHash: string;
  oracleAddress: string;
  deployedAt: string;
}

export interface ResolutionJob {
  id: string;
  marketAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    decision: 'SIDE_A' | 'SIDE_B' | 'UNDECIDED';
    oracleTxHash: string;
  };
}

export async function getOracleTx(
  contractAddress: string
): Promise<OracleDeployment | null> {
  const response = await fetch(`${BRIDGE_SERVICE_URL}/oracle/tx/${contractAddress}`);
  
  if (!response.ok) {
    return null;
  }
  
  return response.json();
}

export async function getResolutionQueue(): Promise<{
  pending: ResolutionJob[];
  processing: ResolutionJob[];
  completed: ResolutionJob[];
}> {
  const response = await fetch(`${BRIDGE_SERVICE_URL}/resolution/queue`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch resolution queue');
  }
  
  return response.json();
}

export async function scheduleResolution(
  marketAddress: string,
  executeAt?: string
): Promise<{ jobId: string }> {
  const response = await fetch(`${BRIDGE_SERVICE_URL}/resolution/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marketAddress,
      executeAt,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return response.json();
}
```

### Usage Example

```typescript
// In a React component
import { getOracleTx } from '../lib/bridgeApi';

function AIConsole({ marketId }: { marketId: string }) {
  const [txHash, setTxHash] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchOracle() {
      const oracle = await getOracleTx(marketId);
      if (oracle) {
        setTxHash(oracle.txHash);
      }
    }
    
    fetchOracle();
  }, [marketId]);
  
  return (
    <div>
      {txHash ? (
        <a href={`https://explorer.genlayer.net/tx/${txHash}`}>
          View on GenLayer Explorer
        </a>
      ) : (
        <span>Waiting for oracle deployment...</span>
      )}
    </div>
  );
}
```

---

## Testing

### cURL Examples

```bash
# Health check
curl http://localhost:3001/health

# Get oracle tx
curl http://localhost:3001/oracle/tx/0xMarketAddress

# Get resolution queue
curl http://localhost:3001/resolution/queue

# Schedule resolution
curl -X POST http://localhost:3001/resolution/schedule \
  -H "Content-Type: application/json" \
  -d '{"marketAddress":"0xMarket...","executeAt":"2025-12-31T23:59:59Z"}'

# Get events
curl "http://localhost:3001/events/resolution-requested?limit=10"
```

### Postman Collection

Import this collection for testing:

```json
{
  "info": {
    "name": "Gnothi Bridge Service",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "Get Oracle TX",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/oracle/tx/{{contractAddress}}"
      }
    },
    {
      "name": "Resolution Queue",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/resolution/queue"
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001"
    },
    {
      "key": "contractAddress",
      "value": "0xMarketAddress"
    }
  ]
}
```

---

## Next Steps

- [Troubleshooting](./09-troubleshooting.md) - Common issues and solutions
- [Contributing](./10-contributing.md) - How to contribute to Gnothi
- [Changelog](./11-changelog.md) - Version history
