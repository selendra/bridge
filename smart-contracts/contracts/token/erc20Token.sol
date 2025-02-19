// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract erc20Token is ERC20 {
    constructor(uint256 initialSupply) ERC20("TestToken", "TTK") {
        _mint(msg.sender, initialSupply);
    }
}