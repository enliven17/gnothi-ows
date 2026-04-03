'use client';

import React from 'react';
import { motion } from 'framer-motion';
import styles from './ArchitectureFlow.module.css';

const ArchitectureFlow: React.FC = () => {
    return (
        <section className={styles.container}>
            <div className={styles.inner}>
                <div className={styles.header}>
                    <p className={styles.label}>Detailed Architecture</p>
                    <h2 className={styles.title}>How it Works: End-to-End</h2>
                    <p className={styles.subtitle}>
                        From USDC acquisition to AI-powered resolution and cross-chain finality.
                    </p>
                </div>

                <div className={styles.diagramContainer}>
                    {/* ── Background Zones (Expanded to fit all elements) ── */}
                    <div className={styles.zone} style={{ left: '20px', top: '40px', width: '420px', height: '520px' }}>
                        <span className={styles.zoneLabel}>User Zone</span>
                    </div>
                    <div className={styles.zone} style={{ left: '460px', top: '40px', width: '310px', height: '520px', background: 'rgba(245, 175, 175, 0.03)' }}>
                        <span className={styles.zoneLabel}>Base Sepolia (L2)</span>
                    </div>
                    <div className={styles.zone} style={{ left: '790px', top: '40px', width: '360px', height: '520px', background: 'rgba(192, 132, 252, 0.03)' }}>
                        <span className={styles.zoneLabel}>AI Oracle Network</span>
                    </div>

                    <svg
                        className={styles.flowSvg}
                        viewBox="0 0 1200 600"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        {/* ── Connectors (Static) ── */}
                        <path d="M 120 100 L 220 100" className={styles.pathLine} /> 
                        <path d="M 120 250 L 220 250" className={styles.pathLine} /> 
                        <path d="M 380 250 L 480 250" className={styles.pathLine} /> 
                        <path d="M 660 250 L 800 250" className={styles.pathLine} /> 
                        
                        <path d="M 870 250 L 900 250 L 900 150 L 940 150" className={styles.pathLine} /> 
                        <path d="M 940 180 L 900 180" className={styles.pathLine} />
                        <path d="M 870 280 L 870 380 L 760 380" className={styles.pathLine} /> 
                        <path d="M 600 380 L 580 380 L 580 340" className={styles.pathLine} /> 
                        <path d="M 800 280 L 800 480 L 100 480 L 100 460" className={styles.pathLine} /> 

                        {/* ── Animated Paths ── */}
                        <motion.path
                            d="M 120 100 L 220 100"
                            className={styles.pathAnimated}
                            initial={{ pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                        />
                        <motion.path
                            d="M 120 250 L 220 250"
                            className={styles.pathAnimated}
                            initial={{ pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                        />
                        <motion.path
                            d="M 660 250 L 800 250"
                            className={styles.pathAnimated}
                            initial={{ pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                        />

                        {/* ── Nodes ── */}
                        
                        {/* User */}
                        <g transform="translate(40, 200)">
                            <rect width="80" height="100" className={styles.nodeRect} style={{ fill: '#fff' }} />
                            <text x="40" y="55" textAnchor="middle" className={styles.nodeTitle}>User</text>
                            <text x="40" y="70" textAnchor="middle" className={styles.nodeType}>Wallet</text>
                        </g>

                        {/* MoonPay */}
                        <g transform="translate(220, 60)">
                            <rect width="180" height="80" className={styles.nodeRect} />
                            <text x="90" y="40" textAnchor="middle" className={styles.nodeTitle}>MoonPay</text>
                            <text x="90" y="55" textAnchor="middle" className={styles.nodeType}>On-ramp</text>
                        </g>

                        {/* BetFactory */}
                        <g transform="translate(220, 210)">
                            <rect width="180" height="80" className={styles.nodeRect} />
                            <text x="90" y="40" textAnchor="middle" className={styles.nodeTitle}>BetFactory</text>
                            <text x="90" y="55" textAnchor="middle" className={styles.nodeType}>Contracts</text>
                        </g>

                        {/* BetCOFI */}
                        <g transform="translate(480, 210)">
                            <rect width="200" height="120" className={styles.nodeRect} style={{ stroke: 'var(--primary)', strokeWidth: 2 }} />
                            <text x="100" y="50" textAnchor="middle" className={styles.nodeTitle}>Market Contract</text>
                            <text x="100" y="65" textAnchor="middle" className={styles.nodeType}>BetCOFI.sol</text>
                            <text x="100" y="85" textAnchor="middle" style={{ fontSize: '10px', fill: '#666', fontWeight: 600 }}>Decentralized Pool</text>
                            <text x="100" y="100" textAnchor="middle" style={{ fontSize: '9px', fill: '#999' }}>Verified on Base</text>
                        </g>

                        {/* Bridge Relay */}
                        <g transform="translate(800, 210)">
                            <rect width="140" height="80" className={styles.nodeRect} style={{ fill: '#fafafa' }} />
                            <text x="70" y="40" textAnchor="middle" className={styles.nodeTitle}>Relay Agent</text>
                            <text x="70" y="55" textAnchor="middle" className={styles.nodeType}>Bridge Service</text>
                        </g>

                        {/* GenLayer AI */}
                        <g transform="translate(940, 120)">
                            <circle cx="60" cy="65" r="60" className={styles.nodeRect} style={{ stroke: '#c084fc', fill: '#fdf4ff' }} />
                            <text x="60" y="55" textAnchor="middle" className={styles.nodeTitle}>GenLayer</text>
                            <text x="60" y="70" textAnchor="middle" className={styles.nodeType}>AI Oracle</text>
                            <text x="60" y="85" textAnchor="middle" style={{ fontSize: '9px', fill: '#8b5cf6', fontWeight: 700 }}>LLM Consensus</text>
                        </g>

                        {/* BridgeForwarder */}
                        <g transform="translate(600, 340)">
                            <rect width="160" height="80" className={styles.nodeRect} />
                            <text x="80" y="40" textAnchor="middle" className={styles.nodeTitle}>Forwarder</text>
                            <text x="80" y="55" textAnchor="middle" className={styles.nodeType}>Entry Node</text>
                        </g>

                        {/* MarketBot (Moved to fit User Zone better) */}
                        <g transform="translate(140, 420)">
                            <rect width="180" height="80" rx="40" className={styles.nodeRect} style={{ fill: '#f0f9ff', stroke: '#0ea5e9' }} />
                            <text x="90" y="40" textAnchor="middle" className={styles.nodeTitle}>MarketBot</text>
                            <text x="90" y="55" textAnchor="middle" className={styles.nodeType}>XMTP Protocol</text>
                        </g>

                        {/* Labels for steps */}
                        <g style={{ opacity: 0.8 }}>
                            <text x="40" y="35" fontSize="10" fill="var(--primary)" fontWeight="800">PHASE 1: ONRAMP & WALLET</text>
                            <text x="460" y="35" fontSize="10" fill="var(--primary)" fontWeight="800">PHASE 2: ON-CHAIN MARKETS</text>
                            <text x="800" y="35" fontSize="10" fill="var(--primary)" fontWeight="800">PHASE 3: AI ORACLE RELAY</text>
                        </g>
                    </svg>
                </div>

                <div className={styles.infoGrid}>
                    <div className={styles.infoCard}>
                        <h3 className={styles.infoTitle}>
                            <span className={styles.infoIcon}>🪙</span>
                            Unified Liquidity
                        </h3>
                        <p className={styles.infoText}>
                            Seamless onboarding via <strong>MoonPay</strong> to obtain USDC directly on <strong>Base Sepolia</strong>. 
                            Users can immediately interact with markets without leaving the app.
                        </p>
                    </div>

                    <div className={styles.infoCard}>
                        <h3 className={styles.infoTitle}>
                            <span className={styles.infoIcon}>🧠</span>
                            AI Oracle Consensus
                        </h3>
                        <p className={styles.infoText}>
                            Markets are resolved trustlessly by <strong>GenLayer</strong>'s decentralized LLM swarm. 
                            Independent agents browse the web, verify evidence, and reach a consensus on outcomes.
                        </p>
                    </div>

                    <div className={styles.infoCard}>
                        <h3 className={styles.infoTitle}>
                            <span className={styles.infoIcon}>💬</span>
                            Real-time Notifications
                        </h3>
                        <p className={styles.infoText}>
                            The <strong>MarketBot</strong> uses <strong>XMTP</strong> to notify you the moment a pazar closes or results are finalized, 
                            ensuring you nunca miss a payout.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ArchitectureFlow;
