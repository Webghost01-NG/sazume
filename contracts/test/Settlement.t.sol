// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UnsafeSettlement} from "../src/UnsafeSettlement.sol";
import {IdempotentSettlement} from "../src/IdempotentSettlement.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm { function recordLogs() external; function getRecordedLogs() external returns (Log[] memory); function prank(address) external; }
struct Log { bytes32[] topics; bytes data; address emitter; }

contract SettlementTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PAYER = address(0xA11CE);
    address constant RECIPIENT = address(0xB0B);
    bytes32 constant INTENT = keccak256("ORDER-7F21");
    uint256 constant AMOUNT_USDC6 = 1_000_000;
    MockUSDC token;

    function setUp() public { token = new MockUSDC(); token.mint(PAYER, AMOUNT_USDC6 * 3); }

    function testUnsafeDuplicateTransfersAndEmitsTwice() public {
        UnsafeSettlement app = new UnsafeSettlement(address(token));
        vm.prank(PAYER); token.approve(address(app), type(uint256).max);
        vm.recordLogs();
        vm.prank(PAYER); app.settle(INTENT, RECIPIENT, AMOUNT_USDC6);
        vm.prank(PAYER); app.settle(INTENT, RECIPIENT, AMOUNT_USDC6);
        Log[] memory logs = vm.getRecordedLogs();
        require(token.balanceOf(RECIPIENT) == 2 * AMOUNT_USDC6, "UNSAFE_TOTAL");
        require(_settlementEvents(logs, address(app), INTENT) == 2, "UNSAFE_EVENTS");
    }

    function testFixedDuplicateRevertsWithoutTransferOrSecondEvent() public {
        IdempotentSettlement app = new IdempotentSettlement(address(token));
        vm.prank(PAYER); token.approve(address(app), type(uint256).max);
        vm.recordLogs();
        vm.prank(PAYER); app.settle(INTENT, RECIPIENT, AMOUNT_USDC6);
        (bool duplicateOk,) = address(app).call(abi.encodeCall(app.settle, (INTENT, RECIPIENT, AMOUNT_USDC6)));
        Log[] memory logs = vm.getRecordedLogs();
        require(!duplicateOk, "DUPLICATE_DID_NOT_REVERT");
        require(token.balanceOf(RECIPIENT) == AMOUNT_USDC6, "FIXED_TOTAL");
        require(_settlementEvents(logs, address(app), INTENT) == 1, "FIXED_EVENTS");
    }

    function testEventsPreserveIntentPayerRecipientAndUSDC6Amount() public {
        require(token.decimals() == 6, "NOT_USDC6");
        UnsafeSettlement app = new UnsafeSettlement(address(token));
        vm.prank(PAYER); token.approve(address(app), type(uint256).max);
        vm.recordLogs();
        vm.prank(PAYER); app.settle(INTENT, RECIPIENT, AMOUNT_USDC6);
        Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) if (logs[i].emitter == address(app) && logs[i].topics.length == 4) {
            require(logs[i].topics[1] == INTENT, "EVENT_INTENT");
            require(address(uint160(uint256(logs[i].topics[2]))) == PAYER, "EVENT_PAYER");
            require(address(uint160(uint256(logs[i].topics[3]))) == RECIPIENT, "EVENT_RECIPIENT");
            require(abi.decode(logs[i].data, (uint256)) == AMOUNT_USDC6, "EVENT_AMOUNT"); found = true;
        }
        require(found, "MISSING_EVENT");
    }

    function testFixedEventPreservesIntentPayerRecipientAndUSDC6Amount() public {
        IdempotentSettlement app = new IdempotentSettlement(address(token));
        vm.prank(PAYER); token.approve(address(app), type(uint256).max);
        vm.recordLogs();
        vm.prank(PAYER); app.settle(INTENT, RECIPIENT, AMOUNT_USDC6);
        Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) if (logs[i].emitter == address(app) && logs[i].topics.length == 4) {
            require(logs[i].topics[1] == INTENT, "EVENT_INTENT");
            require(address(uint160(uint256(logs[i].topics[2]))) == PAYER, "EVENT_PAYER");
            require(address(uint160(uint256(logs[i].topics[3]))) == RECIPIENT, "EVENT_RECIPIENT");
            require(abi.decode(logs[i].data, (uint256)) == AMOUNT_USDC6, "EVENT_AMOUNT"); found = true;
        }
        require(found, "MISSING_EVENT");
    }

    function _settlementEvents(Log[] memory logs, address emitter, bytes32 intent) private pure returns (uint256 count) {
        for (uint256 i; i < logs.length; ++i) if (logs[i].emitter == emitter && logs[i].topics.length == 4 && logs[i].topics[1] == intent) count++;
    }
}
