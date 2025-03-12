import { BigNumber } from "ethers";

export interface BridgeConfig {
  sourceChain: {
    rpcUrl: string;
    bridgeAddress: string;
    domainId: number;
  };
  destinationChain: {
    rpcUrl: string;
    bridgeAddress: string;
    domainId: number;
  };
}

export interface ResourceConfig {
  resourceId: string;
  sourceHandlerAddress: string;
  destinationHandlerAddress: string;
  tokenAddress?: string;
}

export interface Proposal {
  originDomainID: number;
  depositNonce: BigNumber;
  resourceID: string;
  data: string;
}

export enum HandlerType {
  ERC20 = "ERC20",
  ERC721 = "ERC721",
  GMP = "GMP"
}

export interface DepositData {
  handlerType: HandlerType;
  tokenAddress?: string;
  recipient: string;
  amount?: BigNumber;
  tokenId?: BigNumber;
  metadata?: string;
  calldata?: string;
}

export interface DepositResult {
  depositNonce: BigNumber;
  transactionHash: string;
  handlerResponse: string;
}

export interface ExecuteProposalResult {
  transactionHash: string;
  success: boolean;
  handlerResponse?: string;
  errorMessage?: string;
}

export interface FeeData {
  tokenAddress?: string;
  feeAmount?: BigNumber;
}

export interface ERC20HandlerData {
  recipient: string;
  amount: BigNumber;
}

export interface ERC721HandlerData {
  recipient: string;
  tokenId: BigNumber;
  metadata?: string;
}

export interface GMPHandlerData {
  recipient: string;
  calldata: string;
}