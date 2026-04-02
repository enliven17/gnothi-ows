// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title SCEMScoring - Strictly Proper Scoring Rule (Quadratic)
/// @notice Implements S(r, q) = 2·q·r - q²
/// @dev q and r are integers in [0,100]. Score is in units of percent².
///      q = confidence in predicted outcome (1–99)
///      r = 100 if prediction was correct, 0 otherwise
///      Result is always > 0 for any q ∈ [1,99] when r = 100
library SCEMScoring {
    /// @param q Predicted confidence (1–99). Relative to the bettor's chosen side.
    /// @param r 100 if prediction correct, 0 if incorrect.
    /// @return Quadratic scoring rule value. Positive = rewarded, negative = penalized.
    function computeScore(uint8 q, uint8 r) internal pure returns (int256) {
        int256 qi = int256(uint256(q));
        int256 ri = int256(uint256(r));
        return 2 * qi * ri - qi * qi;
    }
}
