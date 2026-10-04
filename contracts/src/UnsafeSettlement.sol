// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20, SafeTransferFrom} from "./IERC20.sol";

contract UnsafeSettlement {
    using SafeTransferFrom for IERC20;
    IERC20 public immutable usdc;

    event IntentSettled(bytes32 indexed intentId, address indexed payer, address indexed recipient, uint256 amount);

    constructor(address usdcAddress) { usdc = IERC20(usdcAddress); }

    function settle(bytes32 intentId, address recipient, uint256 amount) external {
        require(recipient != address(0) && amount != 0, "INVALID_PAYMENT");
        usdc.safeTransferFrom(msg.sender, recipient, amount);
        emit IntentSettled(intentId, msg.sender, recipient, amount);
    }
}
