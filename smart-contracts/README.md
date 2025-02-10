## Selendra Bridge

- deploy erc20Token
```sh
source .env && forge script script/deployerc20Token.s.sol --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
```

- deploy deployBridgecontract
```sh
source .env && forge script script/deployBridgecontract.s.s.sol --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
```