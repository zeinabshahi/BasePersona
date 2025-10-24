// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BMStreak1155 — daily BM + soulbound streak badges on Base
contract BMStreak1155 is ERC1155, Ownable, Pausable {
    // -------- Errors --------
    error AlreadyCheckedIn();
    error TransfersDisabled();
    error InvalidBadge();
    error NotEligible();

    // -------- Types --------
    struct User {
        uint32 lastDay;        // last UTC day number the user checked in
        uint32 currentStreak;  // consecutive days
        uint32 longestStreak;  // best consecutive days
        uint64 total;          // lifetime BM count
    }

    struct ClaimWindow {
        uint32 startDay; // inclusive (UTC day number)
        uint32 endDay;   // inclusive (UTC day number)
    }

    // -------- Storage --------
    mapping(address => User) public users;
    mapping(address => mapping(uint256 => ClaimWindow)) public claimedWindow;

    uint64 public globalTotal;
    mapping(uint32 => uint64) public totalsByDay;

    // badge ids
    uint256 public constant BADGE_7D   = 1;
    uint256 public constant BADGE_30D  = 2;
    uint256 public constant BADGE_90D  = 3;
    uint256 public constant BADGE_180D = 4;
    uint256 public constant BADGE_365D = 5;

    // fees
    address public treasury;
    uint256 public bmFeeWei;

    // -------- Events --------
    event BM(address indexed user, uint32 indexed day, uint32 streak, uint8 reaction);
    event BadgeClaimed(address indexed user, uint256 indexed badgeId, uint32 startDay, uint32 endDay);
    event TreasuryUpdated(address indexed treasury);
    event BmFeeUpdated(uint256 feeWei);

    constructor(string memory _baseURI, address initialOwner, address treasury_)
        ERC1155(_baseURI)
        Ownable(initialOwner)
    {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    // -------- BM check-in (payable) --------
    function bm(uint8 reaction) external payable whenNotPaused {
        if (bmFeeWei > 0) {
            require(msg.value == bmFeeWei, "FEE");
            (bool ok,) = treasury.call{value: msg.value}("");
            require(ok, "PAY");
        }

        uint32 day = _dayNumber(block.timestamp);
        User memory u = users[msg.sender];
        if (u.lastDay == day) revert AlreadyCheckedIn();

        uint32 newCurrent = (u.lastDay + 1 == day && u.lastDay != 0) ? u.currentStreak + 1 : 1;
        uint32 newLongest = u.longestStreak;
        if (newCurrent > newLongest) newLongest = newCurrent;

        users[msg.sender] = User({
            lastDay: day,
            currentStreak: newCurrent,
            longestStreak: newLongest,
            total: u.total + 1
        });

        unchecked {
            globalTotal += 1;
            totalsByDay[day] += 1;
        }

        emit BM(msg.sender, day, newCurrent, reaction);
    }

    // -------- Badges --------
    function claimBadge(uint256 badgeId) external whenNotPaused {
        uint32 threshold = _threshold(badgeId);
        User memory u = users[msg.sender];
        if (u.currentStreak < threshold) revert NotEligible();
        if (balanceOf(msg.sender, badgeId) > 0) revert NotEligible();

        uint32 endDay = u.lastDay;
        uint32 startDay = endDay - threshold + 1;

        claimedWindow[msg.sender][badgeId] = ClaimWindow({startDay: startDay, endDay: endDay});
        _mint(msg.sender, badgeId, 1, "");
        emit BadgeClaimed(msg.sender, badgeId, startDay, endDay);
    }

    function _threshold(uint256 badgeId) internal pure returns (uint32) {
        if (badgeId == BADGE_7D) return 7;
        if (badgeId == BADGE_30D) return 30;
        if (badgeId == BADGE_90D) return 90;
        if (badgeId == BADGE_180D) return 180;
        if (badgeId == BADGE_365D) return 365;
        revert InvalidBadge();
    }

    // -------- Views --------
    function getUser(address a) external view returns (uint32, uint32, uint32, uint64) {
        User memory u = users[a];
        return (u.lastDay, u.currentStreak, u.longestStreak, u.total);
    }

    function currentStreakWindow(address a)
        external
        view
        returns (uint32 startDay, uint32 endDay, uint256 startTs, uint256 endTs)
    {
        User memory u = users[a];
        if (u.currentStreak == 0) return (0, 0, 0, 0);
        endDay = u.lastDay;
        startDay = endDay - u.currentStreak + 1;
        startTs = uint256(startDay) * 1 days;
        endTs = (uint256(endDay) + 1) * 1 days - 1;
    }

    function dayNumberAt(uint256 ts) external pure returns (uint32) { return _dayNumber(ts); }
    function _dayNumber(uint256 ts) internal pure returns (uint32) { return uint32(ts / 1 days); }

    // -------- Admin --------
    function setURI(string memory newURI) external onlyOwner { _setURI(newURI); }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function setTreasury(address t) external onlyOwner { treasury = t; emit TreasuryUpdated(t); }
    function setBmFeeWei(uint256 v) external onlyOwner { bmFeeWei = v; emit BmFeeUpdated(v); }

    // -------- Soulbound protection (pure to silence warnings) --------
    function setApprovalForAll(address, bool) public pure override { revert TransfersDisabled(); }

    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override { revert TransfersDisabled(); }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override { revert TransfersDisabled(); }
}
