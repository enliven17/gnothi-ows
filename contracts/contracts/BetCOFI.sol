// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IBetFactoryCOFI.sol";
import "./SCEMScoring.sol";

/// @title BetCOFI - Binary prediction market contract with SCEM payout
/// @notice Users bet on side A or B with a confidence level (1–99).
///         After resolution, winners split the loser pool weighted by their SCEM score.
contract BetCOFI is ReentrancyGuard, Ownable {
    enum BetStatus { ACTIVE, RESOLVING, RESOLVED, UNDETERMINED }
    enum ResolutionType { CRYPTO, STOCKS, NEWS }

    /// @dev Records every individual bet placed for SCEM scoring at resolution time.
    struct TradeSnapshot {
        address trader;
        uint8 probability;   // Confidence in own side (1–99)
        uint256 bondAmount;
        bool onSideA;
    }

    address public immutable creator;
    string public title;
    string public resolutionCriteria;
    string public sideAName;
    string public sideBName;
    uint256 public immutable creationDate;
    uint256 public immutable endDate;
    address public immutable factory;
    IERC20 public immutable token;
    ResolutionType public immutable resolutionType;
    bytes public resolutionData;

    uint256 private constant RESOLUTION_TIMEOUT = 7 days;

    bool public isResolved;
    bool public isSideAWinner;
    BetStatus public status;
    uint256 public resolutionRequestedAt;

    uint256 public totalSideA;
    uint256 public totalSideB;
    mapping(address => uint256) public betsOnSideA;
    mapping(address => uint256) public betsOnSideB;
    mapping(address => bool) public hasClaimed;

    // SCEM
    TradeSnapshot[] public trades;
    mapping(address => uint256) public scemPayout;

    // Resolution results from oracle
    uint256 public resolvedPrice;
    string public winnerValue;

    event BetPlacedOnA(address indexed bettor, uint256 amount, uint8 probability);
    event BetPlacedOnB(address indexed bettor, uint256 amount, uint8 probability);
    event BetResolved(bool sideAWins, uint256 timestamp, uint256 priceValue, string winnerValue);
    event BetUndetermined(uint256 timestamp);
    event WinningsClaimed(address indexed winner, uint256 amount);
    event ResolutionReceived(bool sideAWins);

    constructor(
        address _creator,
        string memory _title,
        string memory _resolutionCriteria,
        string memory _sideAName,
        string memory _sideBName,
        uint256 _endDate,
        address _token,
        address _factory,
        ResolutionType _resolutionType,
        bytes memory _resolutionData
    ) Ownable(_factory) {
        require(_creator != address(0), "Invalid creator address");
        require(_token != address(0), "Invalid token address");
        require(_factory != address(0), "Invalid factory address");
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_sideAName).length > 0, "Side A name cannot be empty");
        require(bytes(_sideBName).length > 0, "Side B name cannot be empty");

        creator = _creator;
        title = _title;
        resolutionCriteria = _resolutionCriteria;
        sideAName = _sideAName;
        sideBName = _sideBName;
        creationDate = block.timestamp;
        endDate = _endDate;
        factory = _factory;
        token = IERC20(_token);
        resolutionType = _resolutionType;
        resolutionData = _resolutionData;
        status = BetStatus.ACTIVE;
    }

    // ============ Betting ============

    /// @param probability Confidence in SIDE_A (1–99)
    function betOnSideAViaFactory(address bettor, uint256 amount, uint8 probability) external {
        require(msg.sender == factory, "Only factory can call");
        require(block.timestamp < endDate, "Betting has ended");
        require(status == BetStatus.ACTIVE, "Bet not active");
        require(amount > 0, "Must bet more than 0");
        require(probability >= 1 && probability <= 99, "Probability must be 1-99");

        betsOnSideA[bettor] += amount;
        totalSideA += amount;
        trades.push(TradeSnapshot({ trader: bettor, probability: probability, bondAmount: amount, onSideA: true }));

        emit BetPlacedOnA(bettor, amount, probability);
    }

    /// @param probability Confidence in SIDE_B (1–99)
    function betOnSideBViaFactory(address bettor, uint256 amount, uint8 probability) external {
        require(msg.sender == factory, "Only factory can call");
        require(block.timestamp < endDate, "Betting has ended");
        require(status == BetStatus.ACTIVE, "Bet not active");
        require(amount > 0, "Must bet more than 0");
        require(probability >= 1 && probability <= 99, "Probability must be 1-99");

        betsOnSideB[bettor] += amount;
        totalSideB += amount;
        trades.push(TradeSnapshot({ trader: bettor, probability: probability, bondAmount: amount, onSideA: false }));

        emit BetPlacedOnB(bettor, amount, probability);
    }

    // ============ Resolution ============

    /// @notice Creator calls after endDate to request oracle resolution
    function resolve() external {
        require(
            IBetFactoryCOFI(factory).canResolveBet(msg.sender, creator),
            "Not authorized to resolve"
        );
        require(block.timestamp >= endDate, "Cannot resolve before end date");
        require(status == BetStatus.ACTIVE, "Bet not active");

        uint8 oldStatus = uint8(status);
        status = BetStatus.RESOLVING;
        resolutionRequestedAt = block.timestamp;

        IBetFactoryCOFI(factory).notifyStatusChange(oldStatus, uint8(status));
        IBetFactoryCOFI(factory).forwardResolutionRequest(uint8(resolutionType));
    }

    /// @notice Called by factory when oracle resolution arrives via bridge
    function setResolution(bytes calldata _message) external {
        require(msg.sender == factory, "Only factory can dispatch");

        (
            address betAddress,
            bool sideAWins,
            bool isUndetermined,
            ,
            ,
            uint256 priceValue,
            string memory winnerVal
        ) = abi.decode(_message, (address, bool, bool, uint256, bytes32, uint256, string));

        require(betAddress == address(this), "Response for wrong bet");
        require(status == BetStatus.RESOLVING, "Not awaiting resolution");

        uint8 oldStatus = uint8(status);
        isResolved = true;
        resolvedPrice = priceValue;
        winnerValue = winnerVal;

        if (isUndetermined) {
            status = BetStatus.UNDETERMINED;
            emit BetUndetermined(block.timestamp);
        } else {
            isSideAWinner = sideAWins;
            status = BetStatus.RESOLVED;
            _applyScemPayout();
            emit BetResolved(sideAWins, block.timestamp, priceValue, winnerVal);
        }

        IBetFactoryCOFI(factory).notifyStatusChange(oldStatus, uint8(status));
        emit ResolutionReceived(sideAWins);
    }

    // ============ SCEM Payout ============

    /// @dev Iterates all trades and distributes the losers' pool to winners
    ///      proportionally by their SCEM score × bond.
    ///      O(n) gas — acceptable for hackathon scale.
    function _applyScemPayout() internal {
        bool _sideAWins = isSideAWinner;

        uint256 losersPool = 0;
        int256 totalWeightedScore = 0;
        bool anyWinners = false;

        // Pass 1 — identify losers pool and total winner weighted score
        for (uint256 i = 0; i < trades.length; i++) {
            TradeSnapshot memory t = trades[i];
            bool isWinner = (t.onSideA == _sideAWins);

            if (!isWinner) {
                losersPool += t.bondAmount;
            } else {
                anyWinners = true;
                // r = 100 because winner always predicted their side correctly
                int256 s = SCEMScoring.computeScore(t.probability, 100);
                // s is always > 0 for probability ∈ [1,99] and r = 100
                totalWeightedScore += s * int256(t.bondAmount);
            }
        }

        // Edge case: no one on winning side — refund everyone
        if (!anyWinners) {
            for (uint256 i = 0; i < trades.length; i++) {
                scemPayout[trades[i].trader] += trades[i].bondAmount;
            }
            return;
        }

        // Pass 2 — compute winner payouts
        for (uint256 i = 0; i < trades.length; i++) {
            TradeSnapshot memory t = trades[i];
            bool isWinner = (t.onSideA == _sideAWins);
            if (!isWinner) continue;

            // Bond returned + proportional share of losers pool
            uint256 payout = t.bondAmount;

            if (totalWeightedScore > 0) {
                int256 s = SCEMScoring.computeScore(t.probability, 100);
                if (s > 0) {
                    uint256 share = (losersPool * uint256(s) * t.bondAmount) / uint256(totalWeightedScore);
                    payout += share;
                }
            }

            scemPayout[t.trader] += payout;
        }
    }

    // ============ Claiming ============

    /// @notice Claim winnings (SCEM-weighted) or refund (UNDETERMINED)
    function claim() external nonReentrant {
        require(isResolved, "Bet not resolved yet");
        require(!hasClaimed[msg.sender], "Already claimed");

        uint256 payout = 0;

        if (status == BetStatus.UNDETERMINED) {
            payout = betsOnSideA[msg.sender] + betsOnSideB[msg.sender];
            require(payout > 0, "No bet to refund");
        } else {
            // RESOLVED: SCEM payout precomputed at resolution
            payout = scemPayout[msg.sender];
            require(payout > 0, "No winnings to claim");
        }

        hasClaimed[msg.sender] = true;
        require(token.transfer(msg.sender, payout), "Transfer failed");
        emit WinningsClaimed(msg.sender, payout);
    }

    /// @notice Returns the currently claimable amount for a user.
    /// @dev Returns 0 if the user has already claimed or the market is unresolved.
    function getClaimableAmount(address user) external view returns (uint256) {
        if (!isResolved || hasClaimed[user]) {
            return 0;
        }

        if (status == BetStatus.UNDETERMINED) {
            return betsOnSideA[user] + betsOnSideB[user];
        }

        if (status == BetStatus.RESOLVED) {
            return scemPayout[user];
        }

        return 0;
    }

    /// @notice Creator can cancel if oracle doesn't respond within RESOLUTION_TIMEOUT
    function cancelBet() external {
        require(msg.sender == creator, "Only creator can cancel");
        require(status == BetStatus.RESOLVING, "Can only cancel while resolving");
        require(block.timestamp >= resolutionRequestedAt + RESOLUTION_TIMEOUT, "Timeout not reached");

        uint8 oldStatus = uint8(status);
        isResolved = true;
        status = BetStatus.UNDETERMINED;

        IBetFactoryCOFI(factory).notifyStatusChange(oldStatus, uint8(status));
        emit BetUndetermined(block.timestamp);
    }

    // ============ Views ============

    function getInfo() external view returns (
        address _creator,
        string memory _title,
        string memory _resolutionCriteria,
        string memory _sideAName,
        string memory _sideBName,
        uint256 _creationDate,
        uint256 _endDate,
        bool _isResolved,
        bool _isSideAWinner,
        uint256 _totalSideA,
        uint256 _totalSideB,
        uint256 _resolvedPrice,
        string memory _winnerValue
    ) {
        return (
            creator,
            title,
            resolutionCriteria,
            sideAName,
            sideBName,
            creationDate,
            endDate,
            isResolved,
            isSideAWinner,
            totalSideA,
            totalSideB,
            resolvedPrice,
            winnerValue
        );
    }

    function getUserBets(address user) external view returns (uint256 onSideA, uint256 onSideB) {
        return (betsOnSideA[user], betsOnSideB[user]);
    }

    function getTradeCount() external view returns (uint256) {
        return trades.length;
    }

    function calculatePotentialWinnings(address user) external view returns (
        uint256 ifSideAWins,
        uint256 ifSideBWins
    ) {
        uint256 userBetOnA = betsOnSideA[user];
        uint256 userBetOnB = betsOnSideB[user];

        if (userBetOnA > 0 && totalSideA > 0) {
            uint256 winningsShare = totalSideB > 0 ? (userBetOnA * totalSideB) / totalSideA : 0;
            ifSideAWins = userBetOnA + winningsShare;
        }

        if (userBetOnB > 0 && totalSideB > 0) {
            uint256 winningsShare = totalSideA > 0 ? (userBetOnB * totalSideA) / totalSideB : 0;
            ifSideBWins = userBetOnB + winningsShare;
        }
    }
}
