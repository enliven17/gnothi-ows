// Shared types for markets (aligned to BetCOFI / factory contracts)

export type MarketState = 'ACTIVE' | 'RESOLVING' | 'RESOLVED' | 'UNDETERMINED';
export type MarketOutcome = string;

export interface MarketData {
    id: string; // contract address as ID
    contractId: string;
    title: string;
    ticker: string;
    sideAName?: string;
    sideBName?: string;
    description: string;
    type: 'crypto' | 'stock' | 'other';
    category: 'CRYPTO' | 'STOCKS' | 'NEWS';
    identifier: string;
    deadline: number | string;
    deadlineDate?: string;
    resolutionSource: string;
    resolutionRule: string;
    liquidity: number;
    volume: number;
    state: MarketState;
    resolvedOutcome?: MarketOutcome;
    deadlinePrice?: number;
    priceSymbol?: string;
    statsLoading?: boolean;
    probYes: number;
    probNo: number;
    percentChange: number;
    // GenLayer / NEWS oracle fields
    resolutionTypeId?: number;   // 0=CRYPTO, 1=STOCKS, 2=NEWS
    genLayerTxHash?: string;     // deploy TX of the AI oracle on GenLayer
}

export interface UserPosition {
    amount: number;
    outcome: 'YES' | 'NO';
    claimed?: boolean;
}

export interface UserMarketStatus {
    position?: UserPosition;
    hasPosition: boolean;
    userWon: boolean;
    canClaim: boolean;
    claimed: boolean;
    potentialWinnings: number;
}

// Real implementation using on-chain position reads
export async function getUserMarketStatus(contractId: string, walletAddress: string, marketData?: MarketData): Promise<UserMarketStatus | null> {
    try {
        const { getUserBets, calculateUserWinnings, getUserClaimState } = await import('../lib/onchain/writes');

        // Ensure contractId is a valid contract address (40 hex chars + 0x prefix)
        if (!contractId || contractId.length !== 42 || !contractId.startsWith('0x')) {
            console.error('Invalid contract address:', contractId);
            return null;
        }

        // Get user's bets
        const userBets = await getUserBets(contractId as `0x${string}`, walletAddress as `0x${string}`);
        const hasPosition = userBets.onSideA > 0 || userBets.onSideB > 0;

        if (!hasPosition) {
            return {
                hasPosition: false,
                userWon: false,
                canClaim: false,
                claimed: false,
                potentialWinnings: 0
            };
        }

        // Use market data for resolution info if provided, otherwise assume active
        const isResolved = marketData ? (marketData.state === 'RESOLVED' || marketData.state === 'UNDETERMINED') : false;
        const isSideAWinner = marketData?.resolvedOutcome === marketData?.sideAName;

        // Determine the primary position (larger bet)
        const primarySide = userBets.onSideA >= userBets.onSideB ? 'YES' : 'NO';
        const primaryAmount = primarySide === 'YES' ? userBets.onSideA : userBets.onSideB;

        // Calculate claim eligibility and winnings based on market state
        let userWon = false;
        let potentialWinnings = 0;
        let canClaim = false;
        let claimed = false;

        if (isResolved) {
            const claimState = await getUserClaimState(contractId as `0x${string}`, walletAddress as `0x${string}`);
            claimed = claimState.hasClaimed;

            if (marketData?.state === 'UNDETERMINED') {
                // UNDETERMINED: Everyone gets refund of original bet amount
                userWon = true;
                potentialWinnings = claimState.claimableAmount || (userBets.onSideA + userBets.onSideB);
                canClaim = claimState.claimableAmount > 0;
            } else if (marketData?.state === 'RESOLVED') {
                // RESOLVED: Only winners can claim proportional winnings
                if (isSideAWinner && userBets.onSideA > 0) {
                    userWon = true;
                    potentialWinnings = claimState.claimableAmount;
                    canClaim = claimState.claimableAmount > 0;
                } else if (!isSideAWinner && userBets.onSideB > 0) {
                    userWon = true;
                    potentialWinnings = claimState.claimableAmount;
                    canClaim = claimState.claimableAmount > 0;
                }
                // Losers can't claim in RESOLVED markets
            }
        } else {
            // For active/resolving markets, show potential winnings but no claiming
            const winnings = await calculateUserWinnings(contractId as `0x${string}`, walletAddress as `0x${string}`);
            potentialWinnings = Math.max(winnings.ifSideAWins, winnings.ifSideBWins);
            canClaim = false;
        }

        return {
            position: {
                amount: primaryAmount,
                outcome: primarySide,
                claimed
            },
            hasPosition: true,
            userWon,
            canClaim,
            claimed,
            potentialWinnings
        };
    } catch (error) {
        console.error('Error fetching user market status:', error);
        return null;
    }
}

export { claimRewards, placeBet } from '../lib/onchain/writes';
