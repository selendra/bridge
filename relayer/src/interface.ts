import { ethers } from "ethers";

export interface IContractInstances {
    bridge?: ethers.Contract;
    erc20?: ethers.Contract;
    erc20Handler?: ethers.Contract;
    accessControl?: ethers.Contract;
    defaultMessageReceiver?: ethers.Contract;
}

export interface BridgeProposal {
    originDomainID: number;
    depositNonce: number;
    resourceID: string;
    data: string;
  }


