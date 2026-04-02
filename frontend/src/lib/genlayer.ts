/**
 * GenLayer RPC client helpers for reading transaction / validator state.
 */

const GENLAYER_RPC_URL =
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';

export interface ValidatorResult {
    nodeConfig: { provider: string; model: string };
    executionOutput?: { result?: { stdout?: string } };
    voteType?: string;   // "agree" | "disagree" | "timeout"
}

export interface GenLayerTransaction {
    hash: string;
    status: string;   // "PENDING" | "ACCEPTED" | "FINALIZED" | "UNDETERMINED"
    data?: {
        contract_address?: string;
        leader_result?: { stdout?: string };
        validator_results?: ValidatorResult[];
    };
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(GENLAYER_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const json = await res.json() as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

export async function getTransactionByHash(hash: string): Promise<GenLayerTransaction | null> {
    try {
        const result = await rpcCall('eth_getTransactionByHash', [hash]);
        return result as GenLayerTransaction;
    } catch {
        return null;
    }
}

export async function getContractState(address: string, methodName: string): Promise<unknown> {
    try {
        return await rpcCall('gen_getContractStateByAddress', [address, methodName, []]);
    } catch {
        return null;
    }
}
