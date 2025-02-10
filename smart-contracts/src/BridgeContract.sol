// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BridgeContract is Ownable, ReentrancyGuard {
    // Events
    event TokensLocked(address indexed token, address indexed from, uint256 amount, uint256 nonce);
    event TokensUnlocked(address indexed token, address indexed to, uint256 amount, uint256 nonce);
    
    // Mapping to track processed transactions
    mapping(bytes32 => bool) public processedTransactions;
    
    // Nonce for unique transaction identification
    uint256 public nonce;
    
    // Mapping of supported tokens
    mapping(address => bool) public supportedTokens;
    
    // Constructor
    constructor() {
        nonce = 0;
    }
    
    // Add supported token
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
    
    // Remove supported token
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }
    
    // Lock tokens function
    function lockTokens(address token, uint256 amount) external nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        emit TokensLocked(token, msg.sender, amount, nonce);
        nonce++;
    }
    
    // Unlock tokens function
    function unlockTokens(
        address token,
        address recipient,
        uint256 amount,
        uint256 transactionNonce,
        bytes memory signature
    ) external nonReentrant {
        bytes32 transactionHash = keccak256(abi.encodePacked(token, recipient, amount, transactionNonce));
        require(!processedTransactions[transactionHash], "Transaction already processed");
        require(supportedTokens[token], "Token not supported");
        require(verifySignature(transactionHash, signature), "Invalid signature");
        
        processedTransactions[transactionHash] = true;
        
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.transfer(recipient, amount), "Transfer failed");
        
        emit TokensUnlocked(token, recipient, amount, transactionNonce);
    }
    
    // Verify relayer signature
    function verifySignature(bytes32 messageHash, bytes memory signature) internal view returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(signature);
        address signer = ecrecover(ethSignedMessageHash, v, r, s);
        return signer == owner();
    }
    
    // Split signature into v, r, s components
    function splitSignature(bytes memory sig) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65, "Invalid signature length");
        
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}