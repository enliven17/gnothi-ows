import React from 'react';
import styles from './MarketCard.module.css';
import GeckoWidget from '../SharedMarket/GeckoWidget';
import TradingViewWidget from '../SharedMarket/TradingViewWidget';
import ProbabilityGauge from '../SharedMarket/ProbabilityGauge';
import { MarketData, getUserMarketStatus, UserMarketStatus } from '../../../data/markets';
import { claimRewards } from '../../../lib/onchain/writes';
import { useWallet } from '../../providers/WalletProvider';
import { useToast } from '../../providers/ToastProvider';
import { formatVolume, formatAddress, formatCountdown, formatDeadlineDateTime, formatExactUsdl } from '../../../utils/formatters';
import ResolutionRules from '../Shared/ResolutionRules';
import { useAIConsole, AgentState } from '../../hooks/useAIConsole';

interface MarketCardProps {
    market: MarketData;
    onClick: () => void;
    now?: number;
    // Legacy props for backwards compatibility (will be removed)
    title?: string;
    icon?: string;
    probability?: number;
    volume?: number;
    timeLeft?: string;
    trend?: 'up' | 'down';
    type?: 'crypto' | 'stock' | 'other';
    identifier?: string;
}


const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.65" />
    </svg>
);

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
    if (type === 'crypto') return (
        <svg className={styles.typeIconSvg} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7.5 10.5h4M7.5 7.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H7.5M7.5 10.5h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H7.5V7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
    );
    if (type === 'stock') return (
        <svg className={styles.typeIconSvg} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 14l4-4 3 3 4-6 3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );
    return (
        <svg className={styles.typeIconSvg} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 8h8M6 11h8M6 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
    );
};

// Compact 5-dot AI agent status display for RESOLVING news markets
const MiniAgentView: React.FC<{
    txHash: string | null | undefined;
    sideAName?: string;
    sideBName?: string;
}> = ({ txHash, sideAName = 'YES', sideBName = 'NO' }) => {
    const { agents, finalDecision } = useAIConsole(txHash);

    const slots: Pick<AgentState, 'index' | 'status' | 'decision'>[] = agents.length > 0
        ? agents
        : Array.from({ length: 5 }, (_, i) => ({ index: i + 1, status: 'waiting' as const, decision: null }));

    const dotColor = (agent: Pick<AgentState, 'status' | 'decision'>) => {
        if (agent.status !== 'decided') {
            if (agent.status === 'analyzing') return '#f59e0b';
            if (agent.status === 'scraping') return '#8b5cf6';
            return '#d1d5db';
        }
        if (agent.decision === 'SIDE_A') return '#10b981';
        if (agent.decision === 'SIDE_B') return '#ef4444';
        return '#6b7280';
    };

    const dotShadow = (agent: Pick<AgentState, 'status' | 'decision'>) => {
        if (agent.status === 'analyzing') return '0 0 5px rgba(245, 158, 11, 0.6)';
        if (agent.status === 'scraping') return '0 0 5px rgba(139, 92, 246, 0.5)';
        return undefined;
    };

    const outcomeLabel = finalDecision === 'SIDE_A' ? sideAName
        : finalDecision === 'SIDE_B' ? sideBName
            : finalDecision === 'UNDECIDED' ? 'UNDECIDED'
                : null;

    const outcomeColor = finalDecision === 'SIDE_A' ? '#10b981'
        : finalDecision === 'SIDE_B' ? '#ef4444'
            : '#6b7280';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'rgba(180, 83, 9, 0.75)' }}>
                AI Agents
            </div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                {slots.map((agent, i) => (
                    <div
                        key={i}
                        title={`Agent ${agent.index}: ${agent.status}${agent.decision ? ` → ${agent.decision === 'SIDE_A' ? sideAName : agent.decision === 'SIDE_B' ? sideBName : 'UNDECIDED'}` : ''}`}
                        style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            backgroundColor: dotColor(agent),
                            boxShadow: dotShadow(agent),
                            transition: 'background-color 0.4s ease, box-shadow 0.4s ease',
                            flexShrink: 0,
                        }}
                    />
                ))}
                {outcomeLabel && (
                    <span style={{ marginLeft: '4px', fontSize: '10px', fontWeight: 800, color: outcomeColor }}>
                        → {outcomeLabel}
                    </span>
                )}
            </div>
        </div>
    );
};

const MarketCard: React.FC<MarketCardProps> = ({
    market,
    onClick,
    now,
    // Legacy props for backwards compatibility
    title: legacyTitle,
    icon = '💎',
    probability: legacyProbability,
    volume: legacyVolume,
    trend = 'up',
    type: legacyType,
    identifier: legacyIdentifier
}) => {
    // Use market data or fall back to legacy props
    const title = market?.title || legacyTitle || 'Market';
    const probability = market ? market.probYes * 100 : (legacyProbability || 50);
    const volume = market?.volume || legacyVolume || 0;
    const type = market?.type || legacyType || 'crypto';
    const identifier = market?.identifier || legacyIdentifier;

    // For NEWS markets, detect a known token from the title to show a price chart
    const NEWS_TOKEN_MAP: Array<{ keywords: string[]; coinId: string }> = [
        { keywords: ['bitcoin', 'btc'], coinId: 'bitcoin' },
        { keywords: ['ethereum', 'eth'], coinId: 'ethereum' },
        { keywords: ['solana', 'sol'], coinId: 'solana' },
        { keywords: ['bnb', 'binance'], coinId: 'binancecoin' },
        { keywords: ['xrp', 'ripple'], coinId: 'ripple' },
        { keywords: ['doge', 'dogecoin'], coinId: 'dogecoin' },
        { keywords: ['ada', 'cardano'], coinId: 'cardano' },
        { keywords: ['avax', 'avalanche'], coinId: 'avalanche-2' },
        { keywords: ['matic', 'polygon'], coinId: 'matic-network' },
        { keywords: ['link', 'chainlink'], coinId: 'chainlink' },
    ];
    const newsChartCoinId = type === 'other' ? (() => {
        const haystack = title.toLowerCase();
        for (const entry of NEWS_TOKEN_MAP) {
            if (entry.keywords.some(k => haystack.includes(k))) return entry.coinId;
        }
        return null;
    })() : null;

    const { isConnected, walletAddress } = useWallet();
    const { showToast } = useToast();

    // Get user market status if we have market data and wallet connected
    const [userStatus, setUserStatus] = React.useState<UserMarketStatus | null>(null);

    React.useEffect(() => {
        const fetchUserStatus = async () => {
            if (market && isConnected && walletAddress && market.contractId) {
                try {
                    const status = await getUserMarketStatus(market.contractId, walletAddress, market);
                    setUserStatus(status);
                } catch (error) {
                    console.error('Error fetching user status:', error);
                    setUserStatus(null);
                }
            } else {
                setUserStatus(null);
            }
        };

        fetchUserStatus();
    }, [market, isConnected, walletAddress]);

    // --- Countdown (simple, using raw end date) ---
    const hasNow = typeof now === 'number';
    const deadlineSeconds = (() => {
        if (!market) return null;
        if (market.deadlineDate) {
            const parsed = Date.parse(market.deadlineDate);
            if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
        }
        if (market.deadline !== undefined && market.deadline !== null) {
            const numeric = typeof market.deadline === 'string' ? Number(market.deadline) : market.deadline;
            if (Number.isFinite(numeric)) return numeric;
        }
        return null;
    })();
    const nowSeconds = hasNow ? now! : null;
    const deadlineText = deadlineSeconds !== null ? formatDeadlineDateTime(deadlineSeconds) : null;
    const countdownText = (() => {
        if (deadlineSeconds === null || nowSeconds === null) return null;
        const diffSeconds = deadlineSeconds - nowSeconds;
        if (diffSeconds <= 0) return '0d 0h 0m 0s';
        return formatCountdown(diffSeconds * 1000);
    })();


    const handleClaim = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isConnected) return;
        await claimRewards(market.contractId as `0x${string}`);
    };

    const getActionArea = () => {
        if (!market) {
            // Legacy display
            return (
                <div className={styles.actions}>
                    <span className={`${styles.tag} ${styles.tagYes}`}>YES</span>
                    <span className={`${styles.tag} ${styles.tagNo}`}>NO</span>
                </div>
            );
        }

        if (market.state === 'ACTIVE') {
            return (
                <span className={styles.countdown} title={deadlineText ?? undefined}>
                    {countdownText ?? '—'}
                </span>
            );
        }

        return (
            <span className={styles.deadline} title="Deadline">
                {deadlineText ?? '—'}
            </span>
        );
    };

    const isResolving = market?.state === 'RESOLVING';
    const isFinalized = market?.state === 'RESOLVED' || market?.state === 'UNDETERMINED';

    return (
        <div className={`${styles.card} ${isResolving ? styles.cardResolving : ''} ${isFinalized ? styles.cardFinalized : ''}`} onClick={onClick}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.titleGroup}>
                        <h3 className={styles.title}>{title}</h3>
                        {market?.contractId && (
                            <div className={styles.addressRow}>
                                <span className={styles.addressText}>{formatAddress(market.contractId)}</span>
                                <button
                                    className={styles.copyBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard?.writeText(market.contractId);
                                        showToast('Address copied', 'success');
                                    }}
                                    aria-label="Copy contract address"
                                >
                                    <CopyIcon />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <ProbabilityGauge probability={probability} />
                </div>
            </div>

            <div className={styles.graphContainer}>
                {market?.statsLoading ? (
                    <div className={styles.statsSkeleton}>
                        <div className={styles.skeletonBar}></div>
                    </div>
                ) : isResolving ? (
                    <div className={styles.resolvingStage}>
                        <div className={styles.resolvingBackdrop} aria-hidden="true">
                            <svg className={styles.graphLine} viewBox="0 0 100 40" preserveAspectRatio="none">
                                <path
                                    d="M0,28 C18,30 28,10 46,14 S74,34 100,10"
                                    fill="none"
                                    stroke="rgba(39, 39, 42, 0.55)"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M0,35 L0,40 L100,40 L100,18 C80,22 68,34 52,28 S22,18 0,24 Z"
                                    fill="rgba(39, 39, 42, 0.12)"
                                />
                            </svg>
                        </div>
                        <div className={styles.resolvingOverlay}>
                            <div className={styles.resolvingTitle}>Resolving</div>
                            <div className={styles.resolvingMeta}>
                                <div className={styles.resolvingRow}>
                                    <span className={styles.resolvingLabel}>Deadline</span>
                                    <span className={styles.resolvingValue}>{deadlineText}</span>
                                </div>
                                <div className={styles.resolvingRow}>
                                    <span className={styles.resolvingLabel}>Rule</span>
                                    <span className={`${styles.resolvingValue} ${styles.resolvingRule}`}>
                                        <ResolutionRules market={market} variant="inline" showTitle={false} />
                                    </span>
                                </div>
                            </div>
                            {market.resolutionTypeId === 2 && (
                                <MiniAgentView
                                    txHash={market.genLayerTxHash}
                                    sideAName={market.sideAName}
                                    sideBName={market.sideBName}
                                />
                            )}
                        </div>
                    </div>
                ) : isFinalized ? (
                    (() => {
                        const outcomeTone =
                            market.resolvedOutcome === market.sideAName
                                ? 'yes'
                                : market.resolvedOutcome === market.sideBName
                                    ? 'no'
                                    : market.resolvedOutcome === 'INVALID'
                                        ? 'invalid'
                                        : 'neutral';

                        const finalPrice =
                            market.deadlinePrice !== undefined
                                ? `${market.priceSymbol ?? ''}${market.deadlinePrice.toLocaleString()}`
                                : null;

                        const position = userStatus?.position;
                        const userState = !userStatus?.hasPosition
                            ? 'none'
                            : userStatus.userWon
                                ? userStatus.position?.claimed
                                    ? 'claimed'
                                    : userStatus.canClaim
                                        ? 'claimable'
                                        : 'won'
                                : 'lost';

                        const userLine =
                            userState === 'none'
                                ? 'No position'
                                : 'Your stake';

                        const userSubline =
                            userState === 'none'
                                ? 'You did not participate'
                                : userState === 'lost'
                                    ? position
                                        ? `${formatVolume(position.amount)} on ${position.outcome}`
                                        : null
                                    : userStatus
                                        ? `+${formatExactUsdl(userStatus.potentialWinnings)}`
                                        : null;

                        return (
                            <div className={styles.finalizedCenter}>
                                <div className={styles.marketOutcome}>
                                    <div className={styles.marketOutcomeLabel}>Resolved</div>
                                    <div
                                        className={`${styles.marketOutcomeValue} ${
                                            outcomeTone === 'yes'
                                                ? styles.marketOutcomeYes
                                                : outcomeTone === 'no'
                                                    ? styles.marketOutcomeNo
                                                    : outcomeTone === 'invalid'
                                                        ? styles.marketOutcomeInvalid
                                                        : styles.marketOutcomeNeutral
                                        }`}
                                    >
                                        {market.resolvedOutcome ?? '—'}
                                    </div>
                                </div>

                                <div className={styles.marketFacts}>
                                    <div className={styles.fact}>
                                        <span className={styles.factLabel}>Closed at</span>
                                        <span className={styles.factValue}>{finalPrice ?? '—'}</span>
                                    </div>
                                </div>

                                <div className={styles.userOutcome}>
                                    {!isConnected ? (
                                        <div className={styles.userOutcomeText}>
                                            <div className={`${styles.userOutcomeLine} ${styles.userOutcomeNeutral}`}>
                                                Your stake
                                            </div>
                                            <div className={styles.userOutcomeSubline}>
                                                Connect your wallet to start betting.
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={styles.userOutcomeText}>
                                                <div className={`${styles.userOutcomeLine} ${styles.userOutcomeNeutral}`}>
                                                    {userLine}
                                                </div>
                                                {userSubline && (
                                                    <div
                                                        className={
                                                            userState === 'claimable' || userState === 'won' || userState === 'claimed'
                                                                ? styles.userOutcomePayout
                                                                : styles.userOutcomeSubline
                                                        }
                                                    >
                                                        {userSubline}
                                                    </div>
                                                )}
                                            </div>

                                            {userState === 'claimable' ? (
                                                <button className={`${styles.claimButton} ${styles.claimButtonShimmer}`} onClick={handleClaim}>
                                                    Claim
                                                </button>
                                            ) : userState === 'claimed' ? (
                                                <span className={`${styles.claimButton} ${styles.claimButtonClaimed}`}>
                                                    Claimed
                                                </span>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })()
                ) : type === 'crypto' && identifier ? (
                    <div style={{ height: '100%', width: '100%', pointerEvents: 'none' }}>
                        <GeckoWidget coinId={identifier} mini={true} />
                    </div>
                ) : type === 'stock' && identifier ? (
                    <div style={{ height: '100%', width: '100%', pointerEvents: 'none' }}>
                        <TradingViewWidget symbol={identifier} />
                    </div>
                ) : newsChartCoinId ? (
                    <div style={{ height: '100%', width: '100%', pointerEvents: 'none' }}>
                        <GeckoWidget coinId={newsChartCoinId} mini={true} />
                    </div>
                ) : (
                    <div className={styles.newsPlaceholder}>
                        {/* Probability split bar */}
                        <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, marginBottom: '4px' }}>
                                <span style={{ color: '#10b981' }}>{market?.sideAName ?? 'YES'} {probability.toFixed(0)}%</span>
                                <span style={{ color: '#ef4444' }}>{market?.sideBName ?? 'NO'} {(100 - probability).toFixed(0)}%</span>
                            </div>
                            <div style={{ height: '4px', width: '100%', borderRadius: '2px', background: '#e5e7eb', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${probability}%`, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                            </div>
                        </div>
                        {market?.ticker && (
                            <p className={styles.newsPlaceholderText}>{market.ticker}</p>
                        )}
                        {market?.identifier && (
                            <span className={styles.newsSourceBadge}>
                                {(() => { try { return new URL(market.identifier).hostname.replace('www.', ''); } catch { return market.identifier.slice(0, 30); } })()}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.footer}>
                <div className={styles.footerLeft}>
                    {market?.statsLoading ? (
                        <span className={styles.volumeLoading}></span>
                    ) : (
                        <span className={styles.volume}>{formatVolume(volume)}</span>
                    )}
                </div>
                {getActionArea()}
            </div>
        </div>
    );
};

export default MarketCard;
