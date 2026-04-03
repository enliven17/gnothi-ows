'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './AgenticEconomyCarousel.module.css';

const FEATURES = [
    { 
        id: '01', 
        title: 'Agent Swarm', 
        desc: '5 independent LLM agents resolving real-world events via consensus. Collective intelligence meets crypto-native trust.', 
        label: 'GenLayer Powered'
    },
    { 
        id: '02', 
        title: 'Agent Identity', 
        desc: 'Reputation-gated agent wallets via the Open Wallet Standard (OWS). Giving autonomous agents a secure on-chain identity.', 
        label: 'OWS API'
    },
    { 
        id: '03', 
        title: 'Autonomous Treasury', 
        desc: 'Pool USDC into a shared vault and bet as a collective via GroupMarket.sol. Autonomous group capital for the agent era.', 
        label: 'On-chain Vaults'
    },
    { 
        id: '04', 
        title: 'AI Messaging', 
        desc: 'MarketBot (XMTP) notifies stakeholders of validator votes and final verdicts. Real-time autonomous agent-to-human communication.', 
        label: 'XMTP Agent'
    },
];

const AgenticEconomyCarousel: React.FC = () => {
    const [index, setIndex] = React.useState(0);
    const [direction, setDirection] = React.useState(0);

    const nextStep = React.useCallback(() => {
        setDirection(1);
        setIndex(prev => (prev + 1) % FEATURES.length);
    }, []);

    const prevStep = React.useCallback(() => {
        setDirection(-1);
        setIndex(prev => (prev - 1 + FEATURES.length) % FEATURES.length);
    }, []);

    React.useEffect(() => {
        const timer = setInterval(nextStep, 6000);
        return () => clearInterval(timer);
    }, [nextStep]);

    const activeFeature = FEATURES[index];

    return (
        <section className={styles.container}>
            <div className={styles.backdrop} aria-hidden="true">
                <div className={styles.blob} />
            </div>

            <div className={styles.inner}>
                <div className={styles.header}>
                    <p className={styles.label}>Agentic Economies</p>
                    <h2 className={styles.title}>Autonomous Multi-Agent Systems</h2>
                    <p className={styles.subtitle}>
                        Identity, coordination, and automated resolution for the agent-driven economy.
                    </p>
                </div>

                <div className={styles.sliderWrapper}>
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={index}
                            className={styles.card}
                            custom={direction}
                            initial={{ x: direction > 0 ? -150 : 150, opacity: 0, scale: 0.98 }}
                            animate={{ x: 0, opacity: 1, scale: 1 }}
                            exit={{ x: direction > 0 ? 150 : -150, opacity: 0, scale: 0.98 }}
                            transition={{ 
                                duration: 0.8, 
                                ease: [0.22, 1, 0.36, 1] 
                            }}
                        >
                            <h3 className={styles.nodeTitle}>{activeFeature.title}</h3>
                            <p className={styles.nodeText}>{activeFeature.desc}</p>
                            <div className={styles.sourcePill}>
                                {activeFeature.label}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className={styles.controls}>
                    {FEATURES.map((_, i) => (
                        <button
                            key={i}
                            className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                            onClick={() => {
                                setDirection(i > index ? 1 : -1);
                                setIndex(i);
                            }}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AgenticEconomyCarousel;
