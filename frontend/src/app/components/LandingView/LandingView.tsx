'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import styles from './LandingView.module.css';
import ArchitectureDiagram from './ArchitectureDiagram';

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            delay: i * 0.1,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
    }),
};

const CryptoIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.662 8.514c.264-1.765-.92-2.714-2.482-3.348l.507-2.034-1.238-.309-.494 1.982c-.325-.081-.66-.157-.991-.233l.497-1.996-1.238-.309-.508 2.034c-.272-.064-.538-.124-.795-.188l.001-.005-1.708-.426-.33 1.32s.918.21.899.224c.502.125.592.457.577.721l-.578 2.318c.124.047-.384-.047-.384-.047l.001 0-.81 3.25c-.061.155-.218.381-.568.293.013.018-.899-.224-.899-.224l-.615 1.42 1.611.402c.294.075.585.152.873.226l-.512 2.056 1.238.309.507-2.034c.338.092.668.18.991.264l-.506 2.031 1.239.309.511-2.051c2.115.4 3.704.238 4.372-1.674.54-1.54-.04-2.433-1.154-3.014.811-.187 1.422-.72 1.583-1.815zm-2.833 3.963c-.384 1.543-2.981.71-3.823.5l.682-2.736c.842.21 3.535.624 3.141 2.236zm.42-3.985c-.35 1.404-2.519.691-3.217.518l.62-2.489c.698.174 2.952.501 2.597 1.971z"/>
    </svg>
);

const StocksIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
    </svg>
);

const NewsIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>
    </svg>
);

const MARKET_TYPES = [
    { icon: CryptoIcon, label: 'Crypto',  subtitle: 'Oracle-free 5 minute prediction markets',  source: 'GenLayer Powered'   },
    { icon: StocksIcon, label: 'Stocks',  subtitle: 'Equity outcomes resolved by real market data',  source: 'Yahoo Finance' },
    { icon: NewsIcon,   label: 'News',    subtitle: 'AI reads evidence URLs and delivers a verdict',  source: 'AI-powered'   },
];

const XmtpIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    </svg>
);

const TreasuryIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zM11.5 1L2 6v2h19V6l-9.5-5z"/>
    </svg>
);

const MoonpayIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
);

const BotIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </svg>
);

const COMMONS_FEATURES = [
    {
        icon: XmtpIcon,
        label: 'Group Chat',
        subtitle: 'Per-market XMTP group conversations for traders to coordinate in real time.',
        source: 'XMTP v3',
    },
    {
        icon: TreasuryIcon,
        label: 'Group Treasury',
        subtitle: 'Pool USDC into a shared vault and bet as a collective via GroupMarket.sol.',
        source: 'On-chain',
    },
    {
        icon: MoonpayIcon,
        label: 'USDC Onramp',
        subtitle: 'Buy USDC with a credit card directly in the app — no CEX required.',
        source: 'MoonPay',
    },
    {
        icon: BotIcon,
        label: 'MarketBot',
        subtitle: 'AI-powered bot posts resolution updates and bet notifications into group chats.',
        source: 'XMTP Agent',
    },
];

const LandingView: React.FC = () => {
    const router = useRouter();

    return (
        <div className={styles.page}>

            {/* ── Hero ── */}
            <section className={styles.hero}>
                <div className={styles.aurorabg} aria-hidden="true">
                    <div className={styles.blob1} />
                    <div className={styles.blob2} />
                    <div className={styles.blob3} />
                </div>

                <motion.div
                    className={styles.heroInner}
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                >
                    <motion.span className={styles.badge} variants={fadeUp} custom={0}>
                        <span className={styles.badgeDot} />
                        Base Sepolia · GenLayer · XMTP · MoonPay
                    </motion.span>

                    <motion.h1 className={styles.heroTitle} variants={fadeUp} custom={1}>
                        <span className={styles.noWrap}>Prediction markets</span><br />
                        resolved by <span className={styles.aiGradient}>AI</span>
                    </motion.h1>

                    <motion.p className={styles.heroSub} variants={fadeUp} custom={2}>
                        Bet on real-world events. Markets resolve trustlessly via
                        GenLayer intelligent contracts and bridge results back on-chain.
                    </motion.p>

                    <motion.div className={styles.heroActions} variants={fadeUp} custom={3}>
                        <button
                            className={styles.btnPrimary}
                            onClick={() => router.push('/markets')}
                        >
                            Enter Markets
                        </button>
                        <button
                            className={styles.btnSecondary}
                            onClick={() => router.push('/docs')}
                        >
                            Docs
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            {/* ── Architecture Flow (Detailed How it Works) ── */}
            <ArchitectureDiagram />

            {/* ── Market types ── */}
            <section className={styles.types}>
                <motion.div
                    className={styles.typesInner}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                >
                    <div className={styles.sectionHeader}>
                        <motion.p className={styles.sectionLabel} variants={fadeUp} custom={0}>
                            Market types
                        </motion.p>
                        <motion.h2 className={styles.sectionTitle} variants={fadeUp} custom={0}>
                            What you can bet on
                        </motion.h2>
                    </div>
                    <div className={styles.typeGrid}>
                        {MARKET_TYPES.map((t, i) => (
                            <motion.div
                                key={t.label}
                                className={styles.typeCard}
                                variants={fadeUp}
                                custom={i + 1}
                            >
                                <div className={styles.typeIconArea}>
                                    <t.icon />
                                </div>
                                <h3 className={styles.typeTitle}>{t.label}</h3>
                                <p className={styles.typeSubtitle}>{t.subtitle}</p>
                                <span className={styles.typeSourcePill}>{t.source}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* ── The Commons: Group Coordination Layer ── */}
            <section className={styles.types}>
                <motion.div
                    className={styles.typesInner}
                    style={{ maxWidth: '1200px' }}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                >
                    <div className={styles.sectionHeader}>
                        <motion.p className={styles.sectionLabel} variants={fadeUp} custom={0}>
                            The Commons
                        </motion.p>
                        <motion.h2 className={styles.sectionTitle} variants={fadeUp} custom={0}>
                            Group coordination & shared capital
                        </motion.h2>
                        <motion.p className={styles.heroSub} style={{ marginTop: '8px', textAlign: 'center' }} variants={fadeUp} custom={1}>
                            Trade together. Chat together. Pool capital and bet as a collective.
                        </motion.p>
                    </div>
                    <div className={styles.typeGrid4}>
                        {COMMONS_FEATURES.map((f, i) => (
                            <motion.div
                                key={f.label}
                                className={styles.typeCard}
                                variants={fadeUp}
                                custom={i + 1}
                            >
                                <div className={styles.typeIconArea}>
                                    <f.icon />
                                </div>
                                <h3 className={styles.typeTitle}>{f.label}</h3>
                                <p className={styles.typeSubtitle}>{f.subtitle}</p>
                                <span className={styles.typeSourcePill}>{f.source}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* ── Footer ── */}
            <footer className={styles.footer}>
                <span>gnothi · Base Sepolia</span>
                <span>Powered by{' '}
                    <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GenLayer</a>
                    {' '}·{' '}
                    <a href="https://layerzero.network" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>LayerZero</a>
                    {' '}·{' '}
                    <a href="https://xmtp.org" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>XMTP</a>
                    {' '}·{' '}
                    <a href="https://moonpay.com" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>MoonPay</a>
                </span>
            </footer>

        </div>
    );
};

export default LandingView;
