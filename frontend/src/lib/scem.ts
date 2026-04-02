/**
 * Client-side SCEM (Strictly Proper Scoring Rule) helpers.
 *
 * Formula: S(r, q) = 2·q·r - q²
 *   q = confidence in chosen side (1–99)
 *   r = 100 if correct, 0 if wrong
 *
 * Higher confidence in the right answer → bigger share of the losers pool.
 * Higher confidence in the wrong answer → bigger penalty (but you just lose your bond).
 */

/** Raw SCEM score for a given confidence when the prediction is correct (r = 100). */
export function scemScore(q: number): number {
    const clamped = Math.max(1, Math.min(99, Math.round(q)));
    return 2 * clamped * 100 - clamped * clamped;
}

export interface ScemPreview {
    /** Estimated payout if the bet is correct (bond + share of losers pool). */
    estimatedWinPayout: number;
    /** Raw SCEM score (higher = bigger share). Max ~9999 at q=99. */
    score: number;
    /** Percentage of losers pool this score captures (rough estimate). */
    sharePercent: number;
}

/**
 * Estimate payout if the user wins, based on their confidence and current pool sizes.
 *
 * @param probability   User confidence (1–99)
 * @param bondAmount    USDL amount user is betting
 * @param winnersPool   Total USDL currently on the winning side (excluding this bet)
 * @param losersPool    Total USDL on the losing side
 */
export function scemPreview(
    probability: number,
    bondAmount: number,
    winnersPool: number,
    losersPool: number,
): ScemPreview {
    const q = Math.max(1, Math.min(99, Math.round(probability)));
    const myScore = scemScore(q);

    // Weighted score = score × bond
    const myWeightedScore = myScore * bondAmount;

    // Approximate total weighted score of existing winners (assume avg q = 60)
    const avgExistingScore = scemScore(60);
    const existingWeightedScore = avgExistingScore * winnersPool;

    const totalWeightedScore = myWeightedScore + existingWeightedScore;
    const sharePercent = totalWeightedScore > 0
        ? (myWeightedScore / totalWeightedScore) * 100
        : 100;

    const losersShare = (losersPool * myWeightedScore) / (totalWeightedScore || 1);
    const estimatedWinPayout = bondAmount + losersShare;

    return { estimatedWinPayout, score: myScore, sharePercent };
}
