use ethers::contract::abigen;

abigen!(
    Bridge,
    r#"[ 
        event TokensLocked(address indexed token, address indexed from, uint256 amount, uint256 nonce)
        event TokensUnlocked(address indexed token, address indexed to, uint256 amount, uint256 nonce)
        
        function lockTokens(address token, uint256 amount) external;
        function unlockTokens(address token, address recipient, uint256 amount, uint256 transactionNonce, bytes memory signature) external;
    ]"#
);