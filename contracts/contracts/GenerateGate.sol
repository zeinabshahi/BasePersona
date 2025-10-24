// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GenerateGate — paywall + daily cap for AI "Generate"
/// @notice هر کاربر روزانه تا dailyCap بار می‌تواند با پرداخت genFeeWei عمل Generate را انجام دهد.
///         بک‌اند شما می‌تواند با خواندن رویداد GeneratePaid یا بررسی tx، پرداخت را تأیید کند.
contract GenerateGate is Ownable, Pausable, ReentrancyGuard {
    uint256 public genFeeWei;          // فی Generate (wei)
    address public treasury;           // مقصد دریافت فی
    uint8   public dailyCap = 2;       // سقف روزانه‌ی کاربر (پیش‌فرض: 2)

    struct Quota {
        uint64 day;   // روز جاری (UTC day index = timestamp / 1 days)
        uint8  count; // تعداد استفاده امروز
    }

    mapping(address => Quota) public quotas;     // سهمیه‌ی امروز
    mapping(address => uint256) public paidCount; // مجموع پرداخت‌های کاربر (کل تاریخ)

    /// @dev برای لاگ کامل بک‌اند:
    /// payer: کاربر — ref: شناسه‌ی اختیاری سمت بک‌اند — day: روز یوتی‌سی
    /// value: مقدار پرداخت — dailyCount: شمارش امروز بعد از پرداخت — totalPaid: مجموع کل
    event GeneratePaid(
        address indexed payer,
        bytes32 indexed ref,
        uint64 day,
        uint256 value,
        uint256 dailyCount,
        uint256 totalPaid
    );

    event GenFeeUpdated(uint256 newFeeWei);
    event TreasuryUpdated(address indexed newTreasury);
    event DailyCapUpdated(uint8 newCap);

    constructor(address initialOwner, address treasury_, uint256 feeWei)
        Ownable(initialOwner)
    {
        treasury = treasury_;
        genFeeWei = feeWei;
        emit TreasuryUpdated(treasury_);
        emit GenFeeUpdated(feeWei);
    }

    // ---------------- Admin ----------------

    function setGenFeeWei(uint256 v) external onlyOwner {
        genFeeWei = v;
        emit GenFeeUpdated(v);
    }

    function setTreasury(address t) external onlyOwner {
        treasury = t;
        emit TreasuryUpdated(t);
    }

    function setDailyCap(uint8 v) external onlyOwner {
        require(v > 0, "CAP_ZERO");
        dailyCap = v;
        emit DailyCapUpdated(v);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice اگر انتقال آنی به treasury انجام نشد، مالک می‌تواند وجوه را برداشت کند.
    function sweep(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) to = owner();
        if (amount == 0) amount = address(this).balance;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "SWEEP_FAIL");
    }

    // ---------------- User flow ----------------

    /// @notice پرداخت بدون ref
    function payGenerate() external payable whenNotPaused nonReentrant {
        _pay(bytes32(0));
    }

    /// @notice پرداخت با ref اختیاری (job id / user id / hash)
    function payGenerate(bytes32 ref) external payable whenNotPaused nonReentrant {
        _pay(ref);
    }

    function _pay(bytes32 ref) internal {
        require(genFeeWei > 0, "FEE_OFF");
        require(msg.value == genFeeWei, "BAD_FEE");

        // enforce daily cap
        _enforceDaily(msg.sender);

        // مجموع کل کاربر
        uint256 total = ++paidCount[msg.sender];

        emit GeneratePaid(msg.sender, ref, _currentDay(), msg.value, quotas[msg.sender].count, total);

        // انتقال آنی به خزانه
        if (treasury != address(0)) {
            (bool ok,) = treasury.call{value: msg.value}("");
            require(ok, "TREASURY_SEND");
        }
    }

    // ---------------- Quota helpers ----------------

    function _currentDay() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }

    function currentDay() external view returns (uint64) {
        return _currentDay();
    }

    function _enforceDaily(address user) internal {
        uint64 d = _currentDay();
        Quota storage q = quotas[user];
        if (q.day != d) {
            q.day = d;
            q.count = 0;
        }
        require(q.count < dailyCap, "DAILY_LIMIT");
        unchecked { q.count += 1; }
    }

    /// @notice باقیمانده‌ی امروز کاربر
    function remainingToday(address user) public view returns (uint8 remaining) {
        Quota memory q = quotas[user];
        uint64 d = _currentDay();
        uint8 used = (q.day == d) ? q.count : 0;
        remaining = used >= dailyCap ? 0 : dailyCap - used;
    }

    /// @notice اطلاعات کامل سهمیه برای UI/بک‌اند
    function getUserQuota(address user)
        external
        view
        returns (uint64 day, uint8 usedToday, uint8 cap, uint8 remaining, uint256 totalPaid)
    {
        day = _currentDay();
        Quota memory q = quotas[user];
        usedToday = (q.day == day) ? q.count : 0;
        cap = dailyCap;
        remaining = cap > usedToday ? cap - usedToday : 0;
        totalPaid = paidCount[user];
    }

    // ---------------- Safety ----------------
    receive() external payable { revert("DIRECT_ETH_DENIED"); }
    fallback() external payable { revert("NO_FALLBACK"); }
}
