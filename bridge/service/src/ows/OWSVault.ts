/**
 * OWS Vault — Open Wallet Standard integration for the bridge relay.
 *
 * On Railway/Linux: Uses @open-wallet-standard/core native bindings.
 *   Private keys are encrypted at rest in the vault directory.
 *   The relay wallet is imported once on startup and then accessed by name.
 *
 * On Windows (local dev): Native bindings are unavailable.
 *   Falls back silently — ethers.js handles signing directly from PRIVATE_KEY.
 *   All functions still callable; OWS-specific ones return null/undefined.
 */

import path from 'path';
import os from 'os';

export const OWS_RELAY_WALLET = 'relay-wallet';

// Vault directory: use OWS_VAULT_PATH env or a default under home/tmp
const VAULT_PATH =
  process.env.OWS_VAULT_PATH ??
  (process.env.HOME ? path.join(process.env.HOME, '.ows-vault') : path.join(os.tmpdir(), 'ows-vault'));

type OWSModule = typeof import('@open-wallet-standard/core');

let _ows: OWSModule | null | undefined = undefined; // undefined = not yet attempted

async function loadOWS(): Promise<OWSModule | null> {
  if (_ows !== undefined) return _ows;
  try {
    _ows = await import('@open-wallet-standard/core');
    return _ows;
  } catch {
    console.warn('[OWS] Native bindings unavailable (Windows dev mode) — ethers.js fallback active');
    _ows = null;
    return null;
  }
}

export function isOWSAvailable(): boolean {
  return _ows !== null && _ows !== undefined;
}

/**
 * Initialize the OWS vault on service startup.
 * Imports the relay private key into the encrypted vault if not already present.
 */
export async function initOWSVault(privateKeyHex: string): Promise<void> {
  const sdk = await loadOWS();
  if (!sdk) return;

  const key = privateKeyHex.replace(/^0x/, '');

  try {
    const existing = sdk.getWallet(OWS_RELAY_WALLET, VAULT_PATH);
    const evmAccount = existing.accounts.find(a => a.chainId.startsWith('eip155'));
    console.log(`[OWS] Vault: ${OWS_RELAY_WALLET} already exists — EVM ${evmAccount?.address}`);
  } catch {
    // Not found — import from private key
    const info = sdk.importWalletPrivateKey(
      OWS_RELAY_WALLET,
      key,
      undefined, // no passphrase
      VAULT_PATH,
      'evm',
    );
    const evmAccount = info.accounts.find(a => a.chainId.startsWith('eip155'));
    console.log(`[OWS] Vault: ${OWS_RELAY_WALLET} imported — EVM ${evmAccount?.address}`);
  }
}

/**
 * Return OWS wallet info for the relay wallet (addresses, chain accounts).
 */
export async function getOWSWalletInfo() {
  const sdk = await loadOWS();
  if (!sdk) return null;
  try {
    return sdk.getWallet(OWS_RELAY_WALLET, VAULT_PATH);
  } catch {
    return null;
  }
}

/**
 * List all wallets in the OWS vault.
 */
export async function listOWSVaultWallets() {
  const sdk = await loadOWS();
  if (!sdk) return [];
  try {
    return sdk.listWallets(VAULT_PATH);
  } catch {
    return [];
  }
}

/**
 * Sign an arbitrary message with the relay wallet via OWS.
 * Returns the hex signature, or null if OWS is not available.
 */
export async function signMessageOWS(message: string): Promise<string | null> {
  const sdk = await loadOWS();
  if (!sdk) return null;
  try {
    const result = sdk.signMessage(OWS_RELAY_WALLET, 'evm', message, undefined, undefined, undefined, VAULT_PATH);
    return result.signature;
  } catch (e: any) {
    console.warn('[OWS] signMessage error:', e?.message ?? e);
    return null;
  }
}
