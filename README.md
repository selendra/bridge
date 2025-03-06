# How the Bridge Contract Works

This bridge contract facilitates cross-chain asset transfers using a secure Multi-Party Computation (MPC) system for validation. Let me explain how it functions:

## Core Components

- **Domain IDs**: Each blockchain has a unique domain identifier. The bridge contract is deployed on each chain with its corresponding domain ID.
  
- **MPC System**: Provides security through distributed signature generation - no single entity can authorize transfers.

- **Resource IDs**: Unique 32-byte identifiers that map to specific assets across different chains.

- **Handlers**: Specialized contracts that process different types of assets (ERC20, ERC721, etc.).

## Bridging Process

### 1. Sending Assets from Chain A to Chain B

```plaintext
User (Chain A) → Bridge Contract → Handler → MPC Nodes → Bridge Contract → Handler → User (Chain B)
```
##### When a user wants to transfer assets from Chain A to Chain B:

1. Deposit Initiation:

```sh
function deposit(
    uint8 destinationDomainID,
    bytes32 resourceID,
    bytes calldata depositData,
    bytes calldata feeData
)
```
- User calls deposit() on Chain A's bridge
- Bridge collects fees through the fee handler (if configured)
- Bridge finds the appropriate handler using the resourceID mapping
- Handler locks or burns the tokens on Chain A
- Bridge emits a Deposit event with a unique deposit nonce

2. Off-Chain Processing:

- MPC nodes monitor for Deposit events
- The MPC system reaches consensus and creates a signature

3. Execution on Destination Chain:
```sh
function executeProposals(Proposal[] memory proposals, bytes calldata signature)
```
- A relayer submits the proposal(s) and MPC signature to Chain B's bridge
- Bridge verifies the signature using the EIP-712 standard
- Bridge calls the appropriate handler to release tokens on Chain B
- Bridge marks the proposal as executed (prevents replay attacks)
- Bridge emits a ProposalExecution event

### 2. MPC Management
The bridge includes functions to manage the MPC system:

```sh
function startKeygen() external
function endKeygen(address MPCAddress) external
function refreshKey(string memory hash) external
function retry(string memory txHash) external
```
- startKeygen() and endKeygen(): Initialize the MPC system
- refreshKey(): Rotates MPC keys for security
- retry(): Re-attempts failed transfers

### Security Features
1. Signature Verification: All proposals require valid MPC signatures
2. Nonce Tracking: The usedNonces mapping prevents replay attacks
3. Pausability: Bridge can be paused in emergencies
4. Access Control: Fine-grained permissions via IAccessControlSegregator

### Execution Flow Example
For a token transfer from Selendra (Domain 1) to Ethereum (Domain 2):

1. User calls deposit() on Selendra bridge
2. Selendra handler locks tokens
3. MPC nodes observe the Deposit event
4. MPC nodes generate a signature
5. Relayer calls executeProposals() on Ethereum bridge
6. Ethereum handler mints/unlocks tokens for recipient

## bridge contract
selendra bridge with rust

## smart-contract
- go to smart contract directory
```sh
cd smart-contracts
```

- compile smart contract
```sh
truffle compile
```
- run ganache for testing

```sh
./scripts/start_ganache.sh
```

- run test all
```sh
truffle test
```

- run test witg specific file
```sh
truffle test <test-file>
```