// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/BridgeContract.sol";

contract DeployBridgeContract is Script {
    function run() external {
        vm.startBroadcast();
        new BridgeContract();
        vm.stopBroadcast();
    }
}