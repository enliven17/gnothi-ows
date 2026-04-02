# Troubleshooting

## Common Issues and Solutions

---

## Smart Contracts

### Issue: "Cannot read properties of undefined (reading 'interface')"

**Symptoms**: Frontend fails to load contract interfaces.

**Cause**: Contract ABIs not synced or artifacts missing.

**Solution**:
```bash
cd contracts
npm run compile

cd ../frontend
npm run sync-abis
```

---

### Issue: "USDC transfer failed"

**Symptoms**: Bet placement fails with this error message.

**Possible Causes**:

1. **USDC not approved**
   ```typescript
   // Fix: Approve USDC spending first
   await usdcContract.approve(betFactoryAddress, amount);
   await approvalTx.wait();
   ```

2. **Insufficient USDC balance**
   ```bash
   # Check balance
   cast balance --erc20 0xUSDC_ADDRESS 0xYourWallet
   ```

3. **Wrong USDC address**
   ```bash
   # Base Sepolia USDC
   USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
   ```

---

### Issue: "Bet not active" when trying to resolve

**Symptoms**: `resolve()` call reverts with "Bet not active".

**Cause**: Market already resolved or in wrong status.

**Solution**:
```typescript
// Check market status first
const status = await betContract.status();
console.log('Status:', status); // 0=ACTIVE, 1=RESOLVING, 2=RESOLVED, 3=UNDETERMINED

if (status === 0) {
  // Can resolve
  await betContract.resolve();
} else {
  console.log('Market not in ACTIVE status');
}
```

---

### Issue: "Cannot resolve before end date"

**Symptoms**: Resolution fails even though end date passed.

**Cause**: Timezone confusion or clock skew.

**Solution**:
```typescript
// Check current time vs end date
const now = Math.floor(Date.now() / 1000);
const endDate = await betContract.endDate();

console.log('Now:', now);
console.log('End Date:', endDate.toString());
console.log('Difference:', endDate - now, 'seconds');

if (now >= endDate) {
  // Can resolve
}
```

---

## Bridge Service

### Issue: "EVM→GL Poll error: connect ECONNREFUSED"

**Symptoms**: Bridge service can't connect to Base Sepolia RPC.

**Cause**: RPC endpoint down or wrong URL.

**Solution**:
1. Check RPC URL in `.env`:
   ```bash
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   ```

2. Test RPC connectivity:
   ```bash
   curl -X POST https://sepolia.base.org \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

3. Try alternative RPC:
   ```bash
   BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
   ```

---

### Issue: "Oracle deployment not found"

**Symptoms**: AI Console shows "Oracle deployment not found" indefinitely.

**Possible Causes**:

1. **Bridge service not running**
   ```bash
   cd bridge/service
   npm run dev
   ```

2. **Event not yet detected**
   - Wait 5-10 seconds after resolution is triggered
   - Check bridge service logs for `ResolutionRequested` event

3. **Supabase not configured (if using persistence)**
   ```bash
   # Check .env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your_key
   ```

---

### Issue: "GenLayer RPC error: 401 Unauthorized"

**Symptoms**: Oracle deployment fails with authentication error.

**Cause**: Invalid or missing GenLayer RPC credentials.

**Solution**:
```bash
# Check .env
GENLAYER_RPC_URL=https://rpc.genlayer.net

# If using authenticated endpoint, ensure credentials are correct
GENLAYER_RPC_URL=https://user:pass@rpc.genlayer.net
```

---

### Issue: Bridge service crashes with "Cannot find module"

**Symptoms**: Service fails to start with module error.

**Cause**: Dependencies not installed or build not run.

**Solution**:
```bash
cd bridge/service
npm install
npm run build
npm run dev
```

---

## GenLayer Oracle

### Issue: "UserError: All market parameters are required"

**Symptoms**: Oracle deployment fails immediately.

**Cause**: Missing or empty constructor parameters.

**Solution**:
Check `EvmToGenLayer.ts` deployment code:
```typescript
const args = [
  betContract,      // Must be valid address
  tokenSymbol,      // Must be non-empty string (question)
  tokenName,        // Must be non-empty string (evidence URL)
  title,
  sideAName,
  sideBName,
  bridgeSender,
  targetChainEid,
  targetContract
];

// Validate before deployment
if (!args[1] || !args[2]) {
  console.error('Question or evidence URL is empty');
  return null;
}
```

---

### Issue: "JSON parse error from LLM output"

**Symptoms**: Oracle fails to parse LLM response.

**Cause**: LLM returns non-JSON output or invalid format.

**Solution**:
The oracle has fallback handling:
```python
def _extract_decision(raw: str) -> str:
    try:
        clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip())
        data = json.loads(clean)
        decision = str(data.get("decision", "UNDECIDED")).upper().strip()
        return decision if decision in VALID_DECISIONS else "UNDECIDED"
    except Exception:
        return "UNDECIDED"  # Graceful fallback
```

If this happens frequently, improve prompt engineering:
```python
prompt = f"""...
Instructions:
1. Output ONLY a JSON object with this exact key: {{"decision": "SIDE_A"}}
2. Do NOT include any explanation, markdown, or extra text.
3. The ONLY valid values are: "SIDE_A", "SIDE_B", "UNDECIDED"
"""
```

---

### Issue: "Web scraping returns empty content"

**Symptoms**: Oracle returns `UNDECIDED` for valid URLs.

**Cause**: Website blocks scraping or returns JavaScript-rendered content.

**Solution**:
1. Use text-only mode:
   ```python
   content = gl.nondet.web.render(url, mode="text")
   ```

2. Add fallback URLs:
   ```python
   evidence_urls = [
     "https://example.com/article",
     "https://web.archive.org/web/*/https://example.com/article",  # Fallback
   ]
   ```

3. Avoid paywalled sites (NYT, WSJ, etc.)

---

### Issue: "Consensus timeout"

**Symptoms**: Validators can't reach consensus, market stuck in `RESOLVING`.

**Cause**: Ambiguous evidence or conflicting information.

**Solution**:
1. Wait for timeout (7 days), then creator can `cancelBet()`
2. Improve evidence quality:
   - Use authoritative sources (Reuters, AP, official government sites)
   - Provide multiple URLs if needed
   - Ensure content is clear and unambiguous

---

## Frontend

### Issue: "Failed to connect wallet"

**Symptoms**: Wallet connection fails or hangs.

**Possible Causes**:

1. **Privy not configured**
   ```bash
   # Check .env.local
   NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
   ```

2. **Wrong network**
   - Ensure wallet is on Base Sepolia
   - Add network manually if needed:
     ```
     Network Name: Base Sepolia
     RPC: https://sepolia.base.org
     Chain ID: 84532
     Symbol: ETH
     Explorer: https://sepolia.basescan.org
     ```

---

### Issue: "AI Console shows loading indefinitely"

**Symptoms**: Spinner never stops, no error shown.

**Possible Causes**:

1. **Bridge service URL wrong**
   ```bash
   # Check .env.local
   NEXT_PUBLIC_BRIDGE_SERVICE_URL=http://localhost:3001
   ```

2. **CORS not configured**
   ```bash
   # In bridge/service, ensure CORS allows frontend
   # See bridge/service/src/api.ts
   app.use(cors({
     origin: ['http://localhost:3000', 'https://yourdomain.com']
   }));
   ```

3. **GenLayer RPC unreachable**
   ```bash
   # Test connectivity
   curl https://rpc.genlayer.net
   ```

---

### Issue: "Build failed: Module not found"

**Symptoms**: `npm run build` fails with missing module error.

**Cause**: Dependencies not installed or path issues.

**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

For Windows-specific issues:
```bash
# Clear Next.js cache
rmdir /s /q .next
rmdir /s /q .next-build
npm run build
```

---

### Issue: "Contract call fails with 'invalid address'"

**Symptoms**: Web3 calls fail with address error.

**Cause**: Environment variables not loaded or wrong format.

**Solution**:
```typescript
// Check environment variables
console.log('Factory Address:', process.env.NEXT_PUBLIC_BET_FACTORY_ADDRESS);

// Validate address format
import { isAddress } from 'viem';
const isValid = isAddress(process.env.NEXT_PUBLIC_BET_FACTORY_ADDRESS!);
console.log('Valid address:', isValid);
```

---

## Deployment

### Issue: "Deployment runs out of gas"

**Symptoms**: Contract deployment fails with "out of gas" error.

**Cause**: Gas limit too low or contract too large.

**Solution**:
```bash
# Increase gas limit in hardhat.config.ts
module.exports = {
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      gas: 6000000,  // Increase from default
    }
  }
};
```

---

### Issue: "Private key not valid"

**Symptoms**: Deployment fails with invalid key error.

**Cause**: Wrong format or missing `0x` prefix.

**Solution**:
```bash
# Ensure private key has 0x prefix
PRIVATE_KEY=0xyour_key_here

# Not
PRIVATE_KEY=your_key_here
```

---

### Issue: "Railway deployment fails"

**Symptoms**: Bridge service won't start on Railway.

**Possible Causes**:

1. **Wrong root directory**
   - Set root directory to `bridge/service` in Railway settings

2. **Missing environment variables**
   ```bash
   # Required vars in Railway
   PRIVATE_KEY
   BASE_SEPOLIA_RPC_URL
   BET_FACTORY_ADDRESS
   GENLAYER_RPC_URL
   HTTP_PORT  # Railway provides $PORT automatically
   ```

3. **Build script missing**
   ```json
   // package.json
   {
     "scripts": {
       "build": "tsc",
       "start": "node dist/index.js"
     }
   }
   ```

---

## Performance Issues

### Issue: "AI Console is slow"

**Symptoms**: Validator updates lag or stutter.

**Cause**: Polling too frequent or too many markets.

**Solution**:
```typescript
// Increase polling interval
useEffect(() => {
  const pollInterval = setInterval(pollOracle, 5000);  // 5s instead of 2s
  return () => clearInterval(pollInterval);
}, []);
```

---

### Issue: "Bridge service uses high memory"

**Symptoms**: Service crashes with OOM error.

**Cause**: Event history grows unbounded.

**Solution**:
```typescript
// Limit processed events cache
const MAX_EVENTS = 1000;
if (this.processedEvents.size > MAX_EVENTS) {
  // Remove oldest events
  const toDelete = Array.from(this.processedEvents).slice(0, MAX_EVENTS / 2);
  toDelete.forEach(id => this.processedEvents.delete(id));
}
```

---

## Getting Help

### Debug Checklist

- [ ] Check all `.env` files are correct
- [ ] Verify all services are running
- [ ] Check logs for error messages
- [ ] Test RPC connectivity
- [ ] Validate contract addresses
- [ ] Ensure wallet is on correct network
- [ ] Check bridge service health endpoint

### Useful Commands

```bash
# Check contract deployment
npx hardhat verify --network baseSepolia 0xContractAddress

# Check bridge service status
curl http://localhost:3001/health

# Check GenLayer transaction
curl -X POST https://rpc.genlayer.net \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"genlayer_getTransactionByHash","params":["0xTxHash"],"id":1}'

# View bridge service logs
tail -f bridge/service/logs/*.log
```

### Support Channels

- **GitHub Issues**: https://github.com/enliven17/gnothi/issues
- **Discord**: [Link to Discord]
- **Documentation**: https://docs.gnothi.xyz

---

## Next Steps

- [Contributing](./10-contributing.md) - How to contribute to Gnothi
- [Changelog](./11-changelog.md) - Version history
- [FAQ](./12-faq.md) - Frequently asked questions
