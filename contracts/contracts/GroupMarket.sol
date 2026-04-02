// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GroupMarket
 * @notice Shared treasury for group prediction market participation.
 *
 * Track 04 (The Commons) — Group Coordination & Shared Capital:
 * - Multiple users pool USDC into a shared OWS-linked treasury
 * - The group collectively bets on a prediction market
 * - Winnings are distributed proportionally to each member's contribution
 * - All coordination is tracked onchain — no trust required
 *
 * Flow:
 *  1. Creator deploys GroupMarket with target BetCOFI market + side
 *  2. Members deposit USDC (tracked as shares)
 *  3. Once funding goal met, anyone calls executeBet() → places group bet
 *  4. After market resolves, members call claimShare() → receive USDC payout
 */
contract GroupMarket is ReentrancyGuard {
    IERC20 public immutable usdc;
    address public immutable targetMarket;   // BetCOFI contract address
    address public immutable factory;         // BetFactoryCOFI address
    bool public immutable betOnSideA;         // true = Side A, false = Side B
    uint8 public immutable confidence;        // 1-99, SCEM probability

    address public creator;
    string public groupName;
    uint256 public fundingGoal;              // total USDC target (6 decimals)
    uint256 public totalDeposited;
    bool public betExecuted;
    bool public resolved;
    uint256 public totalPayout;

    mapping(address => uint256) public deposits;
    address[] public members;

    // Events
    event MemberDeposited(address indexed member, uint256 amount);
    event BetExecuted(uint256 totalAmount, bool onSideA, uint8 confidence);
    event PayoutClaimed(address indexed member, uint256 amount);
    event GroupDisbanded(uint256 refundedTotal);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    constructor(
        address _usdc,
        address _factory,
        address _targetMarket,
        bool _betOnSideA,
        uint8 _confidence,
        uint256 _fundingGoal,
        string memory _groupName
    ) {
        require(_confidence >= 1 && _confidence <= 99, "Confidence must be 1-99");
        require(_fundingGoal > 0, "Funding goal must be > 0");

        usdc = IERC20(_usdc);
        factory = _factory;
        targetMarket = _targetMarket;
        betOnSideA = _betOnSideA;
        confidence = _confidence;
        fundingGoal = _fundingGoal;
        groupName = _groupName;
        creator = msg.sender;
    }

    /**
     * @notice Deposit USDC into the group treasury.
     * @param amount Amount in USDC (6 decimals).
     */
    function deposit(uint256 amount) external nonReentrant {
        require(!betExecuted, "Bet already placed");
        require(amount > 0, "Amount must be > 0");
        require(totalDeposited + amount <= fundingGoal * 2, "Exceeds 2x funding goal");

        if (deposits[msg.sender] == 0) {
            members.push(msg.sender);
        }

        usdc.transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalDeposited += amount;

        emit MemberDeposited(msg.sender, amount);
    }

    /**
     * @notice Execute the group bet once enough USDC is deposited.
     * Approves the factory and calls placeBet on behalf of the group.
     */
    function executeBet() external nonReentrant {
        require(!betExecuted, "Bet already placed");
        require(totalDeposited >= fundingGoal, "Funding goal not reached");

        betExecuted = true;

        // Approve factory to pull USDC from this contract
        usdc.approve(factory, totalDeposited);

        // Interface for BetFactoryCOFI.placeBet()
        bytes memory data = abi.encodeWithSignature(
            "placeBet(address,bool,uint256,uint8)",
            targetMarket,
            betOnSideA,
            totalDeposited,
            confidence
        );

        (bool success, ) = factory.call(data);
        require(success, "Bet placement failed");

        emit BetExecuted(totalDeposited, betOnSideA, confidence);
    }

    /**
     * @notice After market resolves, deposit the payout and allow members to claim.
     * Called by anyone after the market has been resolved and payout received.
     */
    function receivePayout() external nonReentrant {
        require(betExecuted, "Bet not placed yet");
        require(!resolved, "Already resolved");

        // Claim from the BetCOFI market contract
        bytes memory data = abi.encodeWithSignature("claimRewards()");
        (bool success, ) = targetMarket.call(data);
        require(success, "Claim failed");

        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No payout received");

        totalPayout = balance;
        resolved = true;
    }

    /**
     * @notice Each member claims their proportional share of the payout.
     */
    function claimShare() external nonReentrant {
        require(resolved, "Not resolved yet");
        uint256 memberDeposit = deposits[msg.sender];
        require(memberDeposit > 0, "No deposit found");

        // Proportional share: (memberDeposit / totalDeposited) * totalPayout
        uint256 share = (totalPayout * memberDeposit) / totalDeposited;
        deposits[msg.sender] = 0; // prevent double claim

        usdc.transfer(msg.sender, share);
        emit PayoutClaimed(msg.sender, share);
    }

    /**
     * @notice Creator can disband the group before the bet is placed (full refund).
     */
    function disband() external onlyCreator nonReentrant {
        require(!betExecuted, "Bet already placed, cannot disband");

        uint256 total = totalDeposited;
        totalDeposited = 0;

        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            uint256 amount = deposits[member];
            if (amount > 0) {
                deposits[member] = 0;
                usdc.transfer(member, amount);
            }
        }

        emit GroupDisbanded(total);
    }

    // ── Views ──────────────────────────────────────────────────────────────────

    function getMemberCount() external view returns (uint256) {
        return members.length;
    }

    function getMembers() external view returns (address[] memory) {
        return members;
    }

    function fundingProgress() external view returns (uint256 deposited, uint256 goal) {
        return (totalDeposited, fundingGoal);
    }
}
