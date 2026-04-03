import React from 'react';
import Image from 'next/image';
import styles from './Header.module.css';
import { useWallet } from '../../providers/WalletProvider';
import { useToast } from '../../providers/ToastProvider';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '../../../lib/onchain/wagmiConfig';
import { baseSepolia } from 'wagmi/chains';
import DisconnectIcon from '../Shared/DisconnectIcon';
import TopUpIcon from '../Shared/TopUpIcon';
import InfoIcon from '../Shared/InfoIcon';
import Tooltip from '../Shared/Tooltip';
import { USDL_ADDRESS, MOCK_USDL_ABI, USDL_MULTIPLIER } from '../../../lib/constants';
import { openMoonPayOnramp, isMoonPayConfigured } from '../../../lib/moonpay/onramp';
import { getMarketCredential, type MarketCredential, formatAccuracy } from '../../../lib/ows/client';

interface HeaderProps {
    onNavigate: (page: 'landing' | 'markets' | 'docs') => void;
    currentPage: 'landing' | 'markets' | 'docs';
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentPage }) => {
    const { isConnected, walletAddress, isConnecting, connect, disconnect } = useWallet();
    const { showToast } = useToast();
    const [usdlBalance, setUsdlBalance] = React.useState<bigint | undefined>(undefined);
    const [walletDropdownOpen, setWalletDropdownOpen] = React.useState(false);
    const [balanceDropdownOpen, setBalanceDropdownOpen] = React.useState(false);
    const [scrolled, setScrolled] = React.useState(false);
    const [owsCredential, setOwsCredential] = React.useState<MarketCredential | null>(null);
    const walletRef = React.useRef<HTMLDivElement>(null);
    const balanceRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const shortAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : '';

    // Fetch USDC balance
    const fetchUsdlBalance = React.useCallback(async () => {
        if (!walletAddress || !isConnected) {
            setUsdlBalance(undefined);
            return;
        }

        try {
            const balance = await readContract(wagmiConfig, {
                chainId: baseSepolia.id,
                address: USDL_ADDRESS,
                abi: MOCK_USDL_ABI,
                functionName: 'balanceOf',
                args: [walletAddress as `0x${string}`]
            });
            setUsdlBalance(balance);
        } catch (error) {
            console.error('Failed to fetch USDC balance:', error);
            setUsdlBalance(undefined);
        }
    }, [walletAddress, isConnected]);

    // Fetch balance when wallet connects/disconnects
    React.useEffect(() => {
        fetchUsdlBalance();
    }, [fetchUsdlBalance]);

    // Fetch OWS credential when wallet connects
    React.useEffect(() => {
        if (!walletAddress) { setOwsCredential(null); return; }
        getMarketCredential(walletAddress).then(setOwsCredential);
    }, [walletAddress]);

    // Memoized handlers to prevent re-render loops
    const handleBalanceClick = React.useCallback(() => {
        setBalanceDropdownOpen(prev => !prev);
    }, []);

    const handleWalletClick = React.useCallback(() => {
        setWalletDropdownOpen(prev => !prev);
    }, []);

    const handleDisconnect = React.useCallback(() => {
        disconnect();
        setWalletDropdownOpen(false);
    }, [disconnect]);

    // Close dropdowns when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (walletRef.current && !walletRef.current.contains(event.target as Node)) {
                setWalletDropdownOpen(false);
            }
            if (balanceRef.current && !balanceRef.current.contains(event.target as Node)) {
                setBalanceDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isLanding = currentPage === 'landing';
    const headerClass = [
        styles.header,
        isLanding && !scrolled ? styles.headerTransparent : '',
        isLanding && scrolled ? styles.headerScrolled : '',
    ].filter(Boolean).join(' ');

    return (
        <header className={headerClass}>
            <div className={styles.left}>
                <div
                    className={styles.logo}
                    onClick={() => onNavigate('landing')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Image src="/gnothi.svg" alt="Logo" width={30} height={30} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', margin: 0 }}>gnothi</h1>
                    </div>
                </div>
            </div>

            <nav className={styles.nav}>
                <span
                    className={`${styles.navItem} ${currentPage === 'markets' ? styles.active : ''}`}
                    onClick={() => onNavigate('markets')}
                >
                    Markets
                </span>
                <span
                    className={`${styles.navItem} ${currentPage === 'docs' ? styles.active : ''}`}
                    onClick={() => onNavigate('docs')}
                >
                    Docs
                </span>
            </nav>

            <div className={styles.right}>
                {isConnected && usdlBalance !== undefined && (
                    <div ref={balanceRef} style={{ position: 'relative', marginRight: '16px' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--card-border)',
                                backgroundColor: 'var(--card-bg)',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: 'var(--foreground)',
                                transition: 'all 0.15s',
                                minWidth: 'fit-content'
                            }}
                            onClick={handleBalanceClick}
                        >
                            {(Number(usdlBalance) / USDL_MULTIPLIER).toFixed(2)} USDC
                            <Tooltip position="bottom" content="USDC on Base Sepolia">
                                <div style={{ marginLeft: '6px', color: 'var(--text-muted)', display: 'flex' }}>
                                    <InfoIcon size={12} />
                                </div>
                            </Tooltip>
                        </div>
                        {balanceDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                backgroundColor: 'var(--background)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                zIndex: 50,
                                minWidth: '160px'
                            }}>
                                {isMoonPayConfigured() && (
                                    <button
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            width: '100%',
                                            padding: '12px 16px',
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            borderRadius: '8px'
                                        }}
                                        onClick={() => {
                                            if (walletAddress) {
                                                openMoonPayOnramp({ walletAddress });
                                                setBalanceDropdownOpen(false);
                                            }
                                        }}
                                    >
                                        <TopUpIcon size={16} />
                                        <span style={{ marginLeft: '8px' }}>Buy USDC</span>
                                    </button>
                                )}
                                <a
                                    href="https://www.alchemy.com/faucets/base-sepolia"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        color: 'inherit'
                                    }}
                                >
                                    <TopUpIcon size={16} />
                                    <span style={{ marginLeft: '8px' }}>Get bETH Sepolia</span>
                                </a>
                            </div>
                        )}
                    </div>
                )}
                {isConnected && (
                    <Tooltip 
                        position="bottom"
                        content={
                        owsCredential && owsCredential.totalMarkets > 0
                            ? `${owsCredential.totalMarkets} markets · ${formatAccuracy(owsCredential.accuracyRate)} · $${owsCredential.totalStaked} staked`
                            : 'Open Wallet Standard — reputation-gated identity'
                    } >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: '1px solid #10b98133',
                            backgroundColor: '#10b9810d',
                            cursor: 'default',
                        }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', letterSpacing: '0.05em' }}>OWS</span>
                            {owsCredential && owsCredential.totalMarkets > 0 && (
                                <span style={{ fontSize: '11px', color: '#10b981', opacity: 0.8 }}>
                                    {owsCredential.accuracyRate.toFixed(0)}%
                                </span>
                            )}
                        </div>
                    </Tooltip>
                )}
                {isConnected ? (
                    <div ref={walletRef} style={{ position: 'relative' }}>
                        <button
                            className={styles.walletButton}
                            onClick={handleWalletClick}
                        >
                            {shortAddress}
                        </button>
                        {walletDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                backgroundColor: 'var(--background)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                zIndex: 50,
                                minWidth: '140px'
                            }}>
                                <button
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        borderRadius: '8px'
                                    }}
                                    onClick={handleDisconnect}
                                >
                                    <DisconnectIcon size={16} />
                                    <span style={{ marginLeft: '8px' }}>Disconnect</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button className={styles.walletButton} onClick={connect} disabled={isConnecting}>
                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
