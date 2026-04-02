'use client';

import { useState, useEffect, useRef } from 'react';
import { getTransactionByHash } from '../../lib/genlayer';

export type AgentStatus = 'waiting' | 'scraping' | 'analyzing' | 'decided';

export interface AgentState {
    index: number;
    model: string;
    provider: string;
    status: AgentStatus;
    decision: 'SIDE_A' | 'SIDE_B' | 'UNDECIDED' | null;
    voteType: string | null;
}

export interface AIConsoleState {
    agents: AgentState[];
    finalDecision: 'SIDE_A' | 'SIDE_B' | 'UNDECIDED' | null;
    txStatus: string;
    isFinalized: boolean;
    error: string | null;
}

function parseDecisionFromOutput(stdout?: string): 'SIDE_A' | 'SIDE_B' | 'UNDECIDED' | null {
    if (!stdout) return null;
    const upper = stdout.toUpperCase();
    if (upper.includes('SIDE_A')) return 'SIDE_A';
    if (upper.includes('SIDE_B')) return 'SIDE_B';
    if (upper.includes('UNDECIDED')) return 'UNDECIDED';
    return null;
}

export function useAIConsole(txHash: string | null | undefined): AIConsoleState {
    const [state, setState] = useState<AIConsoleState>({
        agents: [],
        finalDecision: null,
        txStatus: 'PENDING',
        isFinalized: false,
        error: null,
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stepRef = useRef(0);

    useEffect(() => {
        if (!txHash) return;

        // Animate agents through statuses while polling
        const STATUSES: AgentStatus[] = ['waiting', 'scraping', 'analyzing', 'decided'];

        async function poll() {
            try {
                const tx = await getTransactionByHash(txHash!);

                if (!tx) return;

                const validators = tx.data?.validator_results ?? [];
                const leaderOutput = tx.data?.leader_result?.stdout;
                const finalDecision = parseDecisionFromOutput(leaderOutput);

                // Build agent states
                const agents: AgentState[] = validators.map((v, i) => {
                    const output = v.executionOutput?.result?.stdout;
                    const decision = parseDecisionFromOutput(output);

                    let status: AgentStatus = 'waiting';
                    if (tx.status === 'FINALIZED' || tx.status === 'ACCEPTED') {
                        status = 'decided';
                    } else {
                        // Simulate progression: agents stagger through states
                        const step = Math.min(stepRef.current - i, STATUSES.length - 1);
                        status = STATUSES[Math.max(0, step)] as AgentStatus;
                    }

                    return {
                        index: i + 1,
                        model: v.nodeConfig?.model ?? `Model ${i + 1}`,
                        provider: v.nodeConfig?.provider ?? 'LLM',
                        status,
                        decision: status === 'decided' ? decision : null,
                        voteType: v.voteType ?? null,
                    };
                });

                // If no validators yet, show placeholder agents
                const displayAgents = agents.length > 0
                    ? agents
                    : Array.from({ length: 5 }, (_, i) => ({
                        index: i + 1,
                        model: `Model ${i + 1}`,
                        provider: 'LLM',
                        status: Math.min(stepRef.current - i, STATUSES.length - 1) >= 0
                            ? STATUSES[Math.max(0, Math.min(stepRef.current - i, STATUSES.length - 1))] as AgentStatus
                            : 'waiting' as AgentStatus,
                        decision: null,
                        voteType: null,
                    }));

                const isFinalized = tx.status === 'FINALIZED' || tx.status === 'ACCEPTED';

                setState({
                    agents: displayAgents,
                    finalDecision,
                    txStatus: tx.status,
                    isFinalized,
                    error: null,
                });

                if (isFinalized && intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }

                stepRef.current += 1;
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                setState(prev => ({ ...prev, error: message }));
            }
        }

        poll();
        intervalRef.current = setInterval(poll, 2500);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [txHash]);

    return state;
}
