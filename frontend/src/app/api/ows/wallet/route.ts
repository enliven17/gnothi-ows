import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';

/**
 * OWS Wallet API — backed by @open-wallet-standard/core on Linux/Railway.
 * On Windows (dev), the native binding is unavailable so we return the
 * agent treasury wallet stub from NEXT_PUBLIC_OWNER_ADDRESS.
 */

const VAULT_PATH =
  process.env.OWS_VAULT_PATH ??
  (process.env.HOME ? path.join(process.env.HOME, '.ows-vault') : path.join(os.tmpdir(), 'ows-vault'));

const AGENT_WALLET_NAME = 'gnothi-agent-treasury';

type OWSModule = typeof import('@open-wallet-standard/core');

let _ows: OWSModule | null | undefined = undefined;

async function loadOWS(): Promise<OWSModule | null> {
  if (_ows !== undefined) return _ows;
  try {
    _ows = await import('@open-wallet-standard/core');
    return _ows;
  } catch {
    _ows = null;
    return null;
  }
}

/** Ensure the agent treasury wallet exists in the vault. */
async function ensureAgentWallet(sdk: OWSModule) {
  try {
    return sdk.getWallet(AGENT_WALLET_NAME, VAULT_PATH);
  } catch {
    // Import from owner address private key if provided, otherwise create fresh
    const ownerKey = process.env.OWNER_PRIVATE_KEY;
    if (ownerKey) {
      return sdk.importWalletPrivateKey(
        AGENT_WALLET_NAME,
        ownerKey.replace(/^0x/, ''),
        undefined,
        VAULT_PATH,
        'evm',
      );
    }
    return sdk.createWallet(AGENT_WALLET_NAME, undefined, undefined, VAULT_PATH);
  }
}

/**
 * GET /api/ows/wallet
 * List all OWS wallets from the encrypted vault.
 */
export async function GET() {
  const sdk = await loadOWS();

  if (sdk) {
    try {
      // Ensure the agent treasury exists
      await ensureAgentWallet(sdk);
      const wallets = sdk.listWallets(VAULT_PATH);
      return NextResponse.json({ wallets, backend: 'ows-native' });
    } catch (err: any) {
      console.error('[OWS] listWallets error:', err?.message ?? err);
    }
  }

  // Fallback: return agent treasury stub
  const stubAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS ?? '0x0000000000000000000000000000000000000000';
  return NextResponse.json({
    wallets: [{
      id: AGENT_WALLET_NAME,
      name: AGENT_WALLET_NAME,
      accounts: [{ chainId: 'eip155:84532', address: stubAddress, derivationPath: "m/44'/60'/0'/0/0" }],
      createdAt: new Date().toISOString(),
    }],
    backend: 'stub',
  });
}

/**
 * POST /api/ows/wallet
 * Create or import a wallet into the OWS vault.
 * Body: { name: string, privateKey?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name: string = body.name ?? AGENT_WALLET_NAME;
    const sdk = await loadOWS();

    if (sdk) {
      try {
        // Check if already exists
        const existing = sdk.getWallet(name, VAULT_PATH);
        return NextResponse.json({ wallet: existing, created: false, backend: 'ows-native' }, { status: 200 });
      } catch {
        // Create new
        const wallet = body.privateKey
          ? sdk.importWalletPrivateKey(name, body.privateKey.replace(/^0x/, ''), undefined, VAULT_PATH, 'evm')
          : sdk.createWallet(name, undefined, undefined, VAULT_PATH);
        return NextResponse.json({ wallet, created: true, backend: 'ows-native' }, { status: 201 });
      }
    }

    // Fallback
    const stubAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS ?? '0x0000000000000000000000000000000000000000';
    const stub = {
      id: name,
      name,
      accounts: [{ chainId: 'eip155:84532', address: stubAddress, derivationPath: "m/44'/60'/0'/0/0" }],
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ wallet: stub, created: true, backend: 'stub' }, { status: 201 });
  } catch (err) {
    console.error('[OWS] createWallet error:', err);
    return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
  }
}
