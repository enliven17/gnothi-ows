import React from 'react';
import Image from 'next/image';
import styles from './GenLayerInfo.module.css';

interface GenLayerInfoProps {
    onClose: () => void;
}

const GenLayerInfo: React.FC<GenLayerInfoProps> = ({ onClose }) => {
    return (
        <div className={styles.container}>
            <button className={styles.closeButton} onClick={onClose}>x</button>

            <div className={styles.logoSection}>
                <Image
                    src="/genlayer-logo.webp"
                    alt="GenLayer"
                    width={100}
                    height={100}
                    className={styles.logo}
                />
            </div>

            <div className={styles.content}>
                <p className={styles.description} style={{ marginBottom: '10px' }}>
                    <strong>gnothi</strong> is a prediction market platform powered by <strong>GenLayer&apos;s Intelligent Contracts</strong> and fully on-chain market resolution. Instead of relying on centralized oracles, markets are resolved by GenLayer validators that:
                </p>

                <ul className={styles.description} style={{ paddingLeft: '20px', margin: '10px 0' }}>
                    <li>Fetch real-world data such as crypto prices, stock prices, and news</li>
                    <li>Process non-deterministic data</li>
                    <li>Reach consensus across multiple AI-powered validators</li>
                    <li>Bridge results back to Base via LayerZero</li>
                </ul>

                <p className={styles.description}>
                    Resolution is transparent, verifiable, and requires no trust assumptions.
                </p>
            </div>
        </div>
    );
};

export default GenLayerInfo;
