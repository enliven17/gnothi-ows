'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './ArchitectureDiagram.module.css';

const FLOW_STEPS = [
    { 
        id: '01', 
        title: 'Agent Swarm', 
        desc: '5 independent LLM agents resolving real-world events via consensus.', 
        color: '#FF8F8F', 
        x: 0, 
        y: 0 
    },
    { 
        id: '02', 
        title: 'Agent Identity', 
        desc: 'Reputation-gated agent wallets via the Open Wallet Standard (OWS).', 
        color: '#FFD700', 
        x: 1, 
        y: 0 
    },
    { 
        id: '03', 
        title: 'Autonomous Treasury', 
        desc: 'Pool USDC into a shared vault and bet as a collective via GroupMarket.sol.', 
        color: '#48D1CC', 
        x: 1, 
        y: 1 
    },
    { 
        id: '04', 
        title: 'AI Messaging', 
        desc: 'MarketBot (XMTP) notifies stakeholders of validator votes and final verdicts.', 
        color: '#6A5ACD', 
        x: 0, 
        y: 1 
    },
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

const AgenticEconomyDiagram: React.FC = () => {
    return (
        <section className={styles.container} style={{ background: '#fff9f9', minHeight: '700px', paddingTop: '100px', paddingBottom: '100px' }}>
            <div className={styles.backdrop} aria-hidden="true">
                <div className={styles.blob1} style={{ background: 'radial-gradient(circle, #fff5f5 0%, transparent 70%)', top: '20%', left: '30%' }} />
            </div>

            <div className={styles.inner}>
                <div className={styles.header} style={{ marginBottom: '80px' }}>
                    <p className={styles.label}>Agentic Economies</p>
                    <h2 className={styles.title}>Autonomous Multi-Agent Systems</h2>
                    <p className={styles.subtitle} style={{ margin: '18px auto 0 auto' }}>
                        Identity, coordination, and automated resolution for the agent-driven economy.
                    </p>
                </div>

                <div className={styles.diagramWrapper} style={{ height: '440px', maxWidth: '800px' }}>
                    <svg className={styles.flowLayer} viewBox="0 0 1000 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Perfect square flow connecting 300, 700 X coordinates */}
                        <PathAnimation d="M 300 100 L 700 100 L 700 300 L 300 300" />
                    </svg>

                    <div className={styles.nodeGrid}>
                        {FLOW_STEPS.map((step, i) => (
                            <motion.div
                                key={step.id}
                                className={styles.nodeCard}
                                style={{ 
                                    '--x': step.x,
                                    '--y': step.y,
                                    '--accent': step.color,
                                    // Custom positioning for 2-column layout
                                    left: `calc(50% + (${step.x} - 0.5) * 400px)`,
                                    top: `calc(${step.y} * 200px + 40px)`,
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
            </div>
        </section>
    );
};

export default AgenticEconomyDiagram;
