'use client';

import React from 'react';
import styles from './AIConsole.module.css';
import { useAIConsole, type AgentState } from '../../hooks/useAIConsole';

interface AIConsoleProps {
    resolutionTxHash: string | null | undefined;
    sideAName?: string;
    sideBName?: string;
    question?: string;
    evidenceUrl?: string;
}

const STATUS_LABEL: Record<string, string> = {
    waiting: 'Waiting...',
    scraping: 'Scraping web...',
    analyzing: 'Analyzing evidence...',
    decided: 'Decided',
};

const DECISION_COLOR: Record<string, string> = {
    SIDE_A: '#16a34a',
    SIDE_B: '#dc2626',
    UNDECIDED: '#d97706',
};

function AgentCard({ agent, sideAName, sideBName }: { agent: AgentState; sideAName: string; sideBName: string }) {
    const isPulse = agent.status === 'scraping' || agent.status === 'analyzing';
    const label =
        agent.decision === 'SIDE_A' ? sideAName
        : agent.decision === 'SIDE_B' ? sideBName
        : agent.decision === 'UNDECIDED' ? 'Undecided'
        : null;

    return (
        <div className={`${styles.agentCard} ${isPulse ? styles.pulse : ''}`}>
            <div className={styles.agentHeader}>
                <span className={styles.agentIndex}>Agent {agent.index}</span>
                <span className={styles.agentModel}>{agent.provider} · {agent.model}</span>
            </div>
            <div className={styles.agentStatus}>
                <span className={`${styles.dot} ${styles[agent.status]}`} />
                <span>{STATUS_LABEL[agent.status] ?? agent.status}</span>
            </div>
            {label && (
                <div
                    className={styles.agentDecision}
                    style={{ color: DECISION_COLOR[agent.decision!] }}
                >
                    → {label}
                </div>
            )}
        </div>
    );
}

const AIConsole: React.FC<AIConsoleProps> = ({
    resolutionTxHash,
    sideAName = 'Yes',
    sideBName = 'No',
    question,
    evidenceUrl,
}) => {
    const { agents, finalDecision, txStatus, isFinalized, error } = useAIConsole(resolutionTxHash);

    if (!resolutionTxHash) {
        return (
            <div className={styles.empty}>
                AI Oracle has not been triggered yet. Resolution starts after the market end date.
            </div>
        );
    }

    const finalLabel =
        finalDecision === 'SIDE_A' ? sideAName
        : finalDecision === 'SIDE_B' ? sideBName
        : finalDecision === 'UNDECIDED' ? 'Undecided — funds refunded'
        : null;

    return (
        <div className={styles.console}>
            <div className={styles.header}>
                <span className={styles.title}>GenLayer AI Oracle</span>
                <span className={`${styles.badge} ${isFinalized ? styles.finalized : styles.pending}`}>
                    {isFinalized ? 'Finalized' : txStatus}
                </span>
            </div>

            {question && (
                <div className={styles.txRow}>
                    <span className={styles.txLabel}>Question:</span>
                    <span className={styles.txHash}>{question}</span>
                </div>
            )}
            {evidenceUrl && (
                <div className={styles.txRow}>
                    <span className={styles.txLabel}>Source:</span>
                    <a
                        href={evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.txHash}
                        style={{ textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                        {evidenceUrl}
                    </a>
                </div>
            )}

            <div className={styles.txRow}>
                <span className={styles.txLabel}>TX:</span>
                <span className={styles.txHash}>{resolutionTxHash}</span>
            </div>

            <div className={styles.agents}>
                {agents.map(agent => (
                    <AgentCard
                        key={agent.index}
                        agent={agent}
                        sideAName={sideAName}
                        sideBName={sideBName}
                    />
                ))}
            </div>

            {isFinalized && finalLabel && (
                <div
                    className={styles.verdict}
                    style={{ borderColor: DECISION_COLOR[finalDecision!] }}
                >
                    <span className={styles.verdictLabel}>Consensus Verdict</span>
                    <span
                        className={styles.verdictValue}
                        style={{ color: DECISION_COLOR[finalDecision!] }}
                    >
                        {finalLabel}
                    </span>
                </div>
            )}

            {error && (
                <div className={styles.error}>
                    Failed to fetch oracle status: {error.includes('fetch') || error.includes('network') || error.includes('Network')
                        ? 'Network error — GenLayer RPC may be unreachable.'
                        : error}
                </div>
            )}
        </div>
    );
};

export default AIConsole;
