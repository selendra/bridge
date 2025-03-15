import { ethers } from "ethers";
import { Proposal } from "../types";
import { EIP712_DOMAIN_TYPE, PROPOSAL_TYPE, PROPOSALS_TYPE } from "./constants";

/**
 * Verifies that a signature was produced by the MPC for a given proposal
 */
export function verifyProposalSignature(
  proposal: Proposal | Proposal[],
  signature: string,
  mpcAddress: string,
  bridgeAddress: string,
  chainId: number
): boolean {
  try {
    const domain = {
      name: "Bridge",
      version: "3.1.0",
      chainId,
      verifyingContract: bridgeAddress
    };

    const proposals = Array.isArray(proposal) ? proposal : [proposal];
    const proposalData = {
      proposals: proposals.map(p => ({
        originDomainID: p.originDomainID,
        depositNonce: p.depositNonce.toString(),
        resourceID: p.resourceID,
        data: p.data
      }))
    };

    const types = {
      Proposal: PROPOSAL_TYPE,
      Proposals: PROPOSALS_TYPE
    };

    // Recover the signer from the signature
    const recoveredAddress = ethers.utils.verifyTypedData(
      domain,
      types,
      proposalData,
      signature
    );

    return recoveredAddress.toLowerCase() === mpcAddress.toLowerCase();
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

/**
 * Encode proposal data for EIP-712 signing
 */
export function getEIP712ProposalsHash(
  proposals: Proposal[],
  bridgeAddress: string, 
  chainId: number
): string {
  const domain = {
    name: "Bridge",
    version: "3.1.0",
    chainId,
    verifyingContract: bridgeAddress
  };

  const proposalData = {
    proposals: proposals.map(p => ({
      originDomainID: p.originDomainID,
      depositNonce: p.depositNonce.toString(),
      resourceID: p.resourceID,
      data: p.data
    }))
  };

  const types = {
    Proposal: PROPOSAL_TYPE,
    Proposals: PROPOSALS_TYPE
  };

  return ethers.utils._TypedDataEncoder.hash(domain, types, proposalData);
}