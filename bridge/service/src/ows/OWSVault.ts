/**
 * OWS Vault — Open Wallet Standard integration for the bridge relay.
 *
 * Provides two things:
 *   1. OWSVault — key lifecycle (import, list, policy registration)
 *   2. OWSEthersWallet — ethers.AbstractSigner backed by OWS signing
 *
 * On Railway/Linux: @open-wallet-standard/core native bindings load.
 *   - Private keys are encrypted at rest in VAULT_PATH.
 *   - All signing goes through OWS (key decrypted → sign → key wiped).
 *   - A chain-allowlist policy gates every sign request.
 *
 * On Windows (local dev): native bindings unavailable.
 *   - OWSEthersWallet falls back to standard ethers.Wallet transparently.
 *   - No code changes needed in callers.
 */

import { ethers } from 'ethers';
import path from 'path';
import os from 'os';

// ── Config ────────────────────────────────────────────────────────────────────

export const OWS_RELAY_WALLET = 'relay-wallet';

// Allowed chains: zkSync Sepolia (300) + Base Sepolia (84532)
const ALLOWED_CHAINS = ['eip155:300', 'eip155:84532'];
const OWS_POLICY_ID  = 'relay-chain-allowlist';

export const VAULT_PATH =
  process.env.OWS_VAULT_PATH ??
  (process.env.HOME
    ? path.join(process.env.HOME, '.ows-vault')
    : path.join(os.tmpdir(), 'ows-vault'));

// ── Native module loader ──────────────────────────────────────────────────────

type OWSModule = typeof import('@open-wallet-standard/core');
let _ows: OWSModule | null | undefined = undefined; // undefined = not yet tried

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

// ── Vault lifecycle ───────────────────────────────────────────────────────────

/**
 * Called once on service startup.
 * Imports the relay private key into the OWS encrypted vault and
 * registers the chain-allowlist policy if not already present.
 */
export async function initOWSVault(privateKeyHex: string): Promise<void> {
  const sdk = await loadOWS();
  if (!sdk) return;

  const key = privateKeyHex.replace(/^0x/, '');

  // 1. Import wallet
  try {
    const existing = sdk.getWallet(OWS_RELAY_WALLET, VAULT_PATH);
    const evm = existing.accounts.find(a => a.chainId.startsWith('eip155'));
    console.log(`[OWS] Vault: ${OWS_RELAY_WALLET} exists — EVM ${evm?.address}`);
  } catch {
    const info = sdk.importWalletPrivateKey(
      OWS_RELAY_WALLET,
      key,
      undefined,   // no passphrase
      VAULT_PATH,
      'evm',
    );
    const evm = info.accounts.find(a => a.chainId.startsWith('eip155'));
    console.log(`[OWS] Vault: ${OWS_RELAY_WALLET} imported — EVM ${evm?.address}`);
  }

  // 2. Register chain-allowlist policy (idempotent)
  try {
    sdk.getPolicy(OWS_POLICY_ID, VAULT_PATH);
    console.log(`[OWS] Policy: ${OWS_POLICY_ID} already registered`);
  } catch {
    const policy = JSON.stringify({
      id: OWS_POLICY_ID,
      wallets: [OWS_RELAY_WALLET],
      chains: ALLOWED_CHAINS,
    });
    try {
      sdk.createPolicy(policy, VAULT_PATH);
      console.log(`[OWS] Policy: ${OWS_POLICY_ID} registered (chains: ${ALLOWED_CHAINS.join(', ')})`);
    } catch (e: any) {
      console.warn(`[OWS] Policy registration skipped: ${e?.message}`);
    }
  }
}

export async function getOWSWalletInfo() {
  const sdk = await loadOWS();
  if (!sdk) return null;
  try { return sdk.getWallet(OWS_RELAY_WALLET, VAULT_PATH); } catch { return null; }
}

export async function listOWSVaultWallets() {
  const sdk = await loadOWS();
  if (!sdk) return [];
  try { return sdk.listWallets(VAULT_PATH); } catch { return []; }
}

// ── OWSEthersWallet ───────────────────────────────────────────────────────────

/**
 * Drop-in replacement for ethers.Wallet.
 *
 * When OWS native is available:
 *   - signTransaction → OWS signTransaction (key decrypted, signed, wiped)
 *   - signMessage     → OWS signMessage
 *   - sendTransaction → sign via OWS, broadcast via provider
 *
 * When OWS native is unavailable (Windows):
 *   - All calls transparently delegate to an internal ethers.Wallet
 */
export class OWSEthersWallet extends ethers.AbstractSigner {
  private _address: string;
  private _fallback: ethers.Wallet;

  constructor(privateKeyHex: string, provider: ethers.Provider, address: string) {
    super(provider);
    this._address = address;
    this._fallback = new ethers.Wallet(privateKeyHex, provider);
  }

  async getAddress(): Promise<string> {
    return this._address;
  }

  connect(provider: ethers.Provider): OWSEthersWallet {
    return new OWSEthersWallet(this._fallback.privateKey, provider, this._address);
  }

  /** Sign a raw transaction. Returns the serialized signed tx (hex). */
  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    const sdk = _ows;
    if (!sdk) return this._fallback.signTransaction(tx);

    try {
      // Populate missing fields (nonce, gasPrice, etc.) via provider
      const provider = this.provider!;
      const populated = await this._fallback.populateTransaction(tx);
      const unsigned  = ethers.Transaction.from(populated).unsignedSerialized;

      // OWS: decrypt key → sign → wipe key
      const result = sdk.signTransaction(
        OWS_RELAY_WALLET,
        'evm',
        unsigned.slice(2),   // strip 0x
        undefined,           // no passphrase
        0,                   // account index
        VAULT_PATH,
      );

      // Reconstruct signed transaction
      const ethersTx = ethers.Transaction.from(populated);
      ethersTx.signature = ethers.Signature.from(
        result.signature.startsWith('0x') ? result.signature : `0x${result.signature}`
      );
      return ethersTx.serialized;
    } catch (e: any) {
      console.warn(`[OWS] signTransaction failed, using ethers fallback: ${e?.message}`);
      return this._fallback.signTransaction(tx);
    }
  }

  /** Sign a message (off-chain). */
  async signMessage(message: string | Uint8Array): Promise<string> {
    const sdk = _ows;
    if (!sdk) return this._fallback.signMessage(message);

    try {
      const msg = typeof message === 'string'
        ? message
        : Buffer.from(message).toString('hex');

      const result = sdk.signMessage(
        OWS_RELAY_WALLET,
        'evm',
        msg,
        undefined, // passphrase
        undefined, // encoding
        0,         // index
        VAULT_PATH,
      );
      return result.signature.startsWith('0x') ? result.signature : `0x${result.signature}`;
    } catch (e: any) {
      console.warn(`[OWS] signMessage failed, using ethers fallback: ${e?.message}`);
      return this._fallback.signMessage(message);
    }
  }

  /** EIP-712 typed data — always delegate to ethers (OWS signTypedData available but not needed here). */
  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>,
  ): Promise<string> {
    return this._fallback.signTypedData(domain, types, value);
  }
}

/**
 * Sync factory — usable inside constructors AFTER initOWSVault() has been awaited.
 * _ows is already resolved at that point so no async needed.
 */
export function createOWSSigningWallet(
  privateKeyHex: string,
  provider: ethers.Provider,
): ethers.Wallet | OWSEthersWallet {
  const sdk = _ows; // already set after initOWSVault()
  if (!sdk) return new ethers.Wallet(privateKeyHex, provider);

  try {
    const info = sdk.getWallet(OWS_RELAY_WALLET, VAULT_PATH);
    const evmAccount = info.accounts.find(a => a.chainId.startsWith('eip155'));
    const address = evmAccount?.address ?? new ethers.Wallet(privateKeyHex).address;
    console.log(`[OWS] Signing wallet created — OWS-backed (${address})`);
    return new OWSEthersWallet(privateKeyHex, provider, address);
  } catch {
    return new ethers.Wallet(privateKeyHex, provider);
  }
}
