// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "forge-std/Script.sol";
import "../src/erc20Token.sol";

contract DeployErc20Token is Script {
    function run() external {
        vm.startBroadcast();
        new erc20Token(1_000_000 * 10 ** 18); // Mint 1 million tokens
        vm.stopBroadcast();
    }
}