'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './ArchitectureDiagram.module.css';

const FLOW_STEPS = [
    { id: '01', title: 'User / Dapp', desc: 'Market creation on Base Sepolia.', color: '#FF8F8F', x: 0, y: 0 },
    { id: '02', title: 'Bet Factory', desc: 'Deployed SCEM market contracts.', color: '#FF7F50', x: 1, y: 0 },
    { id: '03', title: 'Bridge Serv.', desc: 'Polling resolution events.', color: '#FFD700', x: 2, y: 0 },
    { id: '04', title: 'AI Oracle', desc: 'GenLayer Bradbury instance.', color: '#9ACD32', x: 2, y: 1 },
    { id: '05', title: 'Web Harvest', desc: 'Fetching real-world evidence.', color: '#48D1CC', x: 1, y: 1 },
    { id: '06', title: 'Consensus', desc: 'Multi-LLM agreement on truth.', color: '#4682B4', x: 0, y: 1 },
    { id: '07', title: 'LZ Bridging', desc: 'Cross-chain message relay.', color: '#6A5ACD', x: 0, y: 2 },
    { id: '08', title: 'Finalization', desc: 'Result verified back on Base.', color: '#BA55D3', x: 1, y: 2 },
    { id: '09', title: 'SCEM Score', desc: 'Entropy-based payout weights.', color: '#FF69B4', x: 2, y: 2 },
    { id: '10', title: 'Settlement', desc: 'USDC Payouts to winners.', color: '#FF4500', x: 2, y: 3 },
];

const PathAnimation = ({ d }: { d: string }) => {
    return (
        <>
            <path d={d} fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth="6" strokeLinecap="round" />
            <motion.path
                d={d}
                fill="none"
                stroke="#FF8F8F"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="10 20"
                animate={{ strokeDashoffset: [0, -90] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
        </>
    );
};

const ArchitectureDiagram: React.FC = () => {
    return (
        <section className={styles.container}>
            <div className={styles.backdrop} aria-hidden="true">
                <div className={styles.blob1} />
                <div className={styles.blob2} />
            </div>

            <div className={styles.header}>
                <p className={styles.label}>Detailed Integration</p>
                <h2 className={styles.title}>The Gnothi Engine</h2>
                <p className={styles.subtitle}>
                    A decentralized workflow bridging Base trading with AI-powered GenLayer resolution.
                </p>
            </div>

            <div className={styles.diagramWrapper}>
                <svg className={styles.flowLayer} viewBox="0 0 1000 800" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <PathAnimation d="M 150 100 L 500 100 L 850 100 L 850 300 L 500 300 L 150 300 L 150 500 L 500 500 L 850 500 L 850 700" />
                </svg>

                <div className={styles.nodeGrid}>
                    {FLOW_STEPS.map((step, i) => (
                        <motion.div
                            key={step.id}
                            className={styles.nodeCard}
                            style={{ 
                                '--x': step.x,
                                '--y': step.y,
                                '--accent': step.color
                            } as any}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                        >
                            <div className={styles.nodeInner}>
                                <div className={styles.nodeBadge} style={{ background: step.color }}>
                                    {step.id}
                                </div>
                                <div className={styles.nodeContent}>
                                    <h3 className={styles.nodeTitle}>{step.title}</h3>
                                    <p className={styles.nodeText}>{step.desc}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ArchitectureDiagram;
