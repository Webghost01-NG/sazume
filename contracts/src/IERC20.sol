// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library SafeTransferFrom {
    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        require(address(token).code.length != 0, "TOKEN_HAS_NO_CODE");
        (bool ok, bytes memory result) = address(token).call(
            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
        );
        require(ok && (result.length == 0 || (result.length == 32 && abi.decode(result, (bool)))), "TRANSFER_FROM_FAILED");
    }
}
