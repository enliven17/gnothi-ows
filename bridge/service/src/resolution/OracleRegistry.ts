/**
 * OracleRegistry - Tracks GenLayer oracle deployments.
 *
 * Priority: Supabase (Railway) → local JSON file → in-memory
 * Table: oracle_deployments (contract_address, tx_hash, oracle_address, deployed_at)
 */

import { getSupabaseClient, isSupabaseConfigured } from '../db/supabase.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export interface OracleRecord {
    txHash: string;
    oracleAddress: string;
    deployedAt: string;
}

// ── Local JSON file persistence (survives bridge restarts in dev) ──────────
const FILE_PATH = path.join(process.cwd(), 'oracle-registry.json');

function loadFile(): Map<string, OracleRecord> {
    try {
        if (existsSync(FILE_PATH)) {
            const raw = readFileSync(FILE_PATH, 'utf-8');
            const obj = JSON.parse(raw) as Record<string, OracleRecord>;
            return new Map(Object.entries(obj));
        }
    } catch (e) {
        console.warn('[OracleRegistry] Could not load file store:', e);
    }
    return new Map();
}

function saveFile(store: Map<string, OracleRecord>): void {
    try {
        const obj = Object.fromEntries(store);
        writeFileSync(FILE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[OracleRegistry] Could not save file store:', e);
    }
}

// Loaded once at startup, written on every update
const fileStore = loadFile();
console.log(`[OracleRegistry] Loaded ${fileStore.size} record(s) from file store`);

export async function recordOracle(
    contractAddress: string,
    txHash: string,
    oracleAddress: string,
): Promise<void> {
    const key = contractAddress.toLowerCase();
    const record: OracleRecord = {
        txHash,
        oracleAddress,
        deployedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
        const { error } = await getSupabaseClient()
            .from('oracle_deployments')
            .upsert({
                contract_address: key,
                tx_hash: txHash,
                oracle_address: oracleAddress,
                deployed_at: record.deployedAt,
            });
        if (error) console.error('[OracleRegistry] Supabase upsert error:', error.message);
    } else {
        fileStore.set(key, record);
        saveFile(fileStore);
    }

    console.log(`[OracleRegistry] Recorded ${contractAddress} → ${txHash}`);
}

export async function getOracle(contractAddress: string): Promise<OracleRecord | null> {
    const key = contractAddress.toLowerCase();

    if (isSupabaseConfigured()) {
        const { data, error } = await getSupabaseClient()
            .from('oracle_deployments')
            .select('tx_hash, oracle_address, deployed_at')
            .eq('contract_address', key)
            .single();

        if (error || !data) return null;
        return {
            txHash: data.tx_hash,
            oracleAddress: data.oracle_address,
            deployedAt: data.deployed_at,
        };
    }

    return fileStore.get(key) ?? null;
}
