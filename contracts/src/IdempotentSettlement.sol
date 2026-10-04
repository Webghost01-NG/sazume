// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20, SafeTransferFrom} from "./IERC20.sol";

contract IdempotentSettlement {
    using SafeTransferFrom for IERC20;
    IERC20 public immutable usdc;
    mapping(bytes32 => bool) public settled;

    event IntentSettled(bytes32 indexed intentId, address indexed payer, address indexed recipient, uint256 amount);

    error IntentAlreadySettled(bytes32 intentId);

    constructor(address usdcAddress) { usdc = IERC20(usdcAddress); }

    function settle(bytes32 intentId, address recipient, uint256 amount) external {
        if (settled[intentId]) revert IntentAlreadySettled(intentId);
        require(recipient != address(0) && amount != 0, "INVALID_PAYMENT");
        // Set before the external call; a failed transfer reverts this update atomically.
        settled[intentId] = true;
        usdc.safeTransferFrom(msg.sender, recipient, amount);
        emit IntentSettled(intentId, msg.sender, recipient, amount);
    }
}
