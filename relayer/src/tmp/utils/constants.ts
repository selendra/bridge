import { utils } from "ethers";

// EIP-712 Types for proposal signatures
export const EIP712_DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" }
];

export const PROPOSAL_TYPE = [
  { name: "originDomainID", type: "uint8" },
  { name: "depositNonce", type: "uint64" },
  { name: "resourceID", type: "bytes32" },
  { name: "data", type: "bytes" }
];

export const PROPOSALS_TYPE = [
  { name: "proposals", type: "Proposal[]" }
];

// Bridge ABI (abbreviated, include only the needed functions)
export const BRIDGE_ABI = [
  "function deposit(uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) external payable returns (uint64 depositNonce, bytes memory handlerResponse)",
  "function executeProposal(tuple(uint8 originDomainID, uint64 depositNonce, bytes32 resourceID, bytes data) memory proposal, bytes calldata signature) public",
  "function executeProposals(tuple(uint8 originDomainID, uint64 depositNonce, bytes32 resourceID, bytes data)[] memory proposals, bytes calldata signature) public",
  "function isProposalExecuted(uint8 domainID, uint256 depositNonce) public view returns (bool)",
  "function _domainID() public view returns (uint8)",
  "function _MPCAddress() public view returns (address)",
  "event Deposit(uint8 destinationDomainID, bytes32 resourceID, uint64 depositNonce, address indexed user, bytes data, bytes handlerResponse)",
  "event ProposalExecution(uint8 originDomainID, uint64 depositNonce, bytes32 dataHash, bytes handlerResponse)",
  "event FailedHandlerExecution(bytes lowLevelData, uint8 originDomainID, uint64 depositNonce)"
];

// ERC20Handler ABI (abbreviated)
export const ERC20_HANDLER_ABI = [
  "function deposit(bytes32 resourceID, address depositer, bytes calldata data) external returns (bytes memory)"
];

// ERC721Handler ABI (abbreviated)
export const ERC721_HANDLER_ABI = [
  "function deposit(bytes32 resourceID, address depositer, bytes calldata data) external returns (bytes memory)"
];

// Update your ERC20_ABI constant in constants.ts
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)" // Add this line
];

// ERC721 ABI (abbreviated)
export const ERC721_ABI = [
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address)"
];

export const pausableABI = ["function paused() view returns (bool)"];

// ABI encoding helpers for deposit data
export function encodeERC20DepositData(recipient: string, amount: string): string {
  return utils.defaultAbiCoder.encode(
    ["address", "uint256"],
    [recipient, amount]
  );
}

export function encodeERC721DepositData(recipient: string, tokenId: string, metadata: string = ""): string {
  return utils.defaultAbiCoder.encode(
    ["address", "uint256", "bytes"],
    [recipient, tokenId, metadata]
  );
}

export function encodeGMPDepositData(recipient: string, calldata: string): string {
  return utils.defaultAbiCoder.encode(
    ["address", "bytes"],
    [recipient, calldata]
  );
}