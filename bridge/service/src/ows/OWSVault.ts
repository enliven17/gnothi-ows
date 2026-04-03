/**
 * OWS Vault — Open Wallet Standard integration for the bridge relay.
 *
 * Two named wallets in the vault:
 *   relay-wallet  — CALLER_PRIVATE_KEY — has CALLER_ROLE on BridgeForwarder (zkSync)
 *   owner-wallet  — PRIVATE_KEY        — approved creator/resolver on BetFactory (Base)
 *
 * On Railway/Linux: @open-wallet-standard/core native bindings active.
 * On Windows (dev): transparent ethers.Wallet fallback.
 */

import { ethers } from 'ethers';
import path from 'path';
import os from 'os';

// ── Wallet names ──────────────────────────────────────────────────────────────
export const OWS_RELAY_WALLET = 'relay-wallet';  // bridge forwarder role
export const OWS_OWNER_WALLET = 'owner-wallet';  // market creator/resolver role

const ALLOWED_CHAINS = ['eip155:300', 'eip155:84532'];
const OWS_POLICY_ID  = 'relay-chain-allowlist';

export const VAULT_PATH =
  process.env.OWS_VAULT_PATH ??
  (process.env.HOME
    ? path.join(process.env.HOME, '.ows-vault')
    : path.join(os.tmpdir(), 'ows-vault'));

// ── Native module loader ──────────────────────────────────────────────────────

type OWSModule = typeof import('@open-wallet-standard/core');
let _ows: OWSModule | null | undefined = undefined;

async function loadOWS(): Promise<OWSModule | null> {
  if (_ows !== undefined) return _ows;
  try {
    _ows = await import('@open-wallet-standard/core');
    return _ows;
  } catch {
    console.warn('[OWS] Native bindings unavailable (Windows dev) — ethers.js fallback active');
    _ows = null;
    return null;
  }
}

export function isOWSAvailable(): boolean {
  return _ows !== null && _ows !== undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function importKey(sdk: OWSModule, name: string, keyHex: string): string {
  const key = keyHex.replace(/^0x/, '');
  try {
    const info = sdk.getWallet(name, VAULT_PATH);
    const evm = info.accounts.find(a => a.chainId.startsWith('eip155'));
    console.log(`[OWS] Vault: ${name} exists — EVM ${evm?.address}`);
    return evm?.address ?? '';
  } catch {
    const info = sdk.importWalletPrivateKey(name, key, undefined, VAULT_PATH, 'evm');
    const evm = info.accounts.find(a => a.chainId.startsWith('eip155'));
    console.log(`[OWS] Vault: ${name} imported — EVM ${evm?.address}`);
    return evm?.address ?? '';
  }
}

// ── Vault lifecycle ───────────────────────────────────────────────────────────

/**
 * Called once on startup. Imports both private keys into OWS vault
 * and registers the chain-allowlist policy.
 *
 * @param callerKey  CALLER_PRIVATE_KEY — relay wallet (BridgeForwarder CALLER_ROLE)
 * @param ownerKey   PRIVATE_KEY       — owner wallet (market creator/resolver)
 */
export async function initOWSVault(callerKey: string, ownerKey?: string): Promise<void> {
  const sdk = await loadOWS();
  if (!sdk) return;

  // Import relay wallet
  if (callerKey) importKey(sdk, OWS_RELAY_WALLET, callerKey);

  // Import owner wallet (may be same key if not separately configured)
  const ownerKeyFinal = ownerKey || callerKey;
  if (ownerKeyFinal) importKey(sdk, OWS_OWNER_WALLET, ownerKeyFinal);

  // Register chain-allowlist policy (idempotent)
  try {
    sdk.getPolicy(OWS_POLICY_ID, VAULT_PATH);
    console.log(`[OWS] Policy: ${OWS_POLICY_ID} already registered`);
  } catch {
    try {
      sdk.createPolicy(
        JSON.stringify({ id: OWS_POLICY_ID, name: 'Relay Chain Allowlist', version: 1, wallets: [OWS_RELAY_WALLET, OWS_OWNER_WALLET], chains: ALLOWED_CHAINS }),
        VAULT_PATH,
      );
      console.log(`[OWS] Policy: ${OWS_POLICY_ID} registered (chains: ${ALLOWED_CHAINS.join(', ')})`);
    } catch (e: any) {
      console.warn(`[OWS] Policy registration skipped: ${e?.message}`);
    }
  }

  // Create API key for bridge service agent access
  await ensureAgentApiKey(sdk);
}

/** Create a scoped API key for bridge service if not already done. */
async function ensureAgentApiKey(sdk: OWSModule): Promise<void> {
  try {
    const keys = sdk.listApiKeys(VAULT_PATH);
    if (keys.some((k: any) => k.name === 'bridge-agent')) {
      console.log('[OWS] API key: bridge-agent already exists');
      return;
    }
    const result = sdk.createApiKey(
      'bridge-agent',
      [OWS_RELAY_WALLET, OWS_OWNER_WALLET],
      [OWS_POLICY_ID],
      '', // no passphrase
      undefined,
      VAULT_PATH,
    );
    // Store token in env for in-process use (not persisted to disk)
    process.env.OWS_AGENT_API_KEY = result.token;
    console.log(`[OWS] API key: bridge-agent created (id: ${result.id})`);
  } catch (e: any) {
    console.warn(`[OWS] API key creation skipped: ${e?.message}`);
  }
}

export async function listOWSVaultWallets() {
  const sdk = await loadOWS();
  if (!sdk) return [];
  try { return sdk.listWallets(VAULT_PATH); } catch { return []; }
}

// ── OWSEthersWallet ───────────────────────────────────────────────────────────

/**
 * Drop-in for ethers.Wallet — backed by OWS signing when native is available.
 *
 * Exposes a sync `.address` getter (like ethers.Wallet) so existing code
 * that reads `wallet.address` continues to work without changes.
 */
export class OWSEthersWallet extends ethers.AbstractSigner {
  private readonly _owsName: string;
  private readonly _address: string;
  private readonly _fallback: ethers.Wallet;

  constructor(owsName: string, privateKeyHex: string, provider: ethers.Provider, address: string) {
    super(provider);
    this._owsName = owsName;
    this._address = address;
    this._fallback = new ethers.Wallet(privateKeyHex, provider);
  }

  /** Sync address accessor — same API as ethers.Wallet.address */
  get address(): string { return this._address; }

  async getAddress(): Promise<string> { return this._address; }

  connect(provider: ethers.Provider): OWSEthersWallet {
    return new OWSEthersWallet(this._owsName, this._fallback.privateKey, provider, this._address);
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    const sdk = _ows;
    if (!sdk) return this._fallback.signTransaction(tx);

    // Always populate and strip 'from'/'kzg' — both OWS and ethers fallback require this
    const populated = await this._fallback.populateTransaction(tx);
    const { from: _from, kzg: _kzg, ...txParams } = populated as any;

    try {
      const unsigned = ethers.Transaction.from(txParams).unsignedSerialized;
      const result = sdk.signTransaction(this._owsName, 'evm', unsigned.slice(2), undefined, 0, VAULT_PATH);
      const ethersTx = ethers.Transaction.from(txParams);
      ethersTx.signature = ethers.Signature.from(
        result.signature.startsWith('0x') ? result.signature : `0x${result.signature}`
      );
      return ethersTx.serialized;
    } catch (e: any) {
      console.warn(`[OWS] signTransaction failed (${this._owsName}), ethers fallback: ${e?.message}`);
      return this._fallback.signTransaction(txParams);
    }
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const sdk = _ows;
    if (!sdk) return this._fallback.signMessage(message);
    try {
      const msg = typeof message === 'string' ? message : Buffer.from(message).toString('hex');
      const result = sdk.signMessage(this._owsName, 'evm', msg, undefined, undefined, 0, VAULT_PATH);
      return result.signature.startsWith('0x') ? result.signature : `0x${result.signature}`;
    } catch (e: any) {
      console.warn(`[OWS] signMessage failed (${this._owsName}), ethers fallback: ${e?.message}`);
      return this._fallback.signMessage(message);
    }
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>,
  ): Promise<string> {
    return this._fallback.signTypedData(domain, types, value);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create an OWS-backed signer for the given named wallet.
 * MUST be called after initOWSVault() (so _ows is already resolved).
 *
 * @param owsName      'relay-wallet' | 'owner-wallet'
 * @param privateKeyHex  Matching private key (used as ethers fallback)
 * @param provider
 */
export function createOWSSigningWallet(
  owsName: typeof OWS_RELAY_WALLET | typeof OWS_OWNER_WALLET,
  privateKeyHex: string,
  provider: ethers.Provider,
): ethers.Wallet | OWSEthersWallet {
  const sdk = _ows;
  if (!sdk) return new ethers.Wallet(privateKeyHex, provider);

  try {
    const info = sdk.getWallet(owsName, VAULT_PATH);
    const evm  = info.accounts.find(a => a.chainId.startsWith('eip155'));
    const addr = evm?.address ?? new ethers.Wallet(privateKeyHex).address;
    console.log(`[OWS] Signing wallet: ${owsName} (${addr})`);
    return new OWSEthersWallet(owsName, privateKeyHex, provider, addr);
  } catch {
    return new ethers.Wallet(privateKeyHex, provider);
  }
}
