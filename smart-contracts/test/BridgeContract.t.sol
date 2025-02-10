// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/BridgeContract.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("TestToken", "TTK") {
        _mint(msg.sender, 10000 * 10 ** 18);
    }
}

contract BridgeContractTest is Test {
    BridgeContract bridge;
    TestToken token;

    address owner = address(1);
    address recipient = address(2);

    function setUp() public {
        vm.prank(owner);
        bridge = new BridgeContract();
        token = new TestToken();

        vm.prank(owner);
        bridge.addSupportedToken(address(token));

        // Transfer some tokens to the owner account
        token.transfer(owner, 1000 * 10 ** 18);
    }

    function testLockTokens() public {
        uint256 amount = 100 * 10 ** 18;

        // Approve the bridge contract to spend tokens on behalf of owner
        vm.prank(owner);
        token.approve(address(bridge), amount);

        // Lock the tokens
        vm.prank(owner);
        bridge.lockTokens(address(token), amount);

        // Check the balance of the bridge contract
        assertEq(token.balanceOf(address(bridge)), amount);
    }

    function testUnlockTokens() public {
        uint256 amount = 100 * 10 ** 18;
        uint256 txNonce = 0;
        bytes32 txHash = keccak256(abi.encodePacked(address(token), recipient, amount, txNonce));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", txHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(owner)), ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Debug: Print the transaction hash and the ethSignedMessageHash
        emit log_bytes32(txHash);
        emit log_bytes32(ethSignedMessageHash);
        emit log_uint(uint256(uint160(owner)));
        emit log_address(owner);

        // Approve the bridge contract to spend tokens on behalf of owner
        vm.prank(owner);
        token.approve(address(bridge), amount);

        // Lock the tokens
        vm.prank(owner);
        bridge.lockTokens(address(token), amount);

        // Unlock the tokens
        vm.prank(owner);
        bridge.unlockTokens(address(token), recipient, amount, txNonce, signature);

        // Check the balance of the recipient
        assertEq(token.balanceOf(recipient), amount);
    }
}