use ethers::types::{Address, Bytes, H256};
use sha2::{Sha256, Digest};

use crate::error::BridgeError;
use crate::types::Proposal;

const DOMAIN_TYPE_HASH: &str = "EIP712Domain(string name,string version)";
const PROPOSALS_TYPE_HASH: &str = "Proposals(Proposal[] proposals)Proposal(uint8 originDomainID,uint64 depositNonce,bytes32 resourceID,bytes data)";
const PROPOSAL_TYPE_HASH: &str = "Proposal(uint8 originDomainID,uint64 depositNonce,bytes32 resourceID,bytes data)";

pub struct BridgeCrypto {
    domain_separator: H256,
    mpc_address: Option<Address>,
}

impl BridgeCrypto {
    pub fn new(name: &str, version: &str) -> Self {
        // Calculate domain separator
        let domain_hash = H256::from_slice(
            &Sha256::new()
                .chain_update(DOMAIN_TYPE_HASH.as_bytes())
                .chain_update(name.as_bytes())
                .chain_update(version.as_bytes())
                .finalize()
        );

        Self {
            domain_separator: domain_hash,
            mpc_address: None,
        }
    }

    pub fn set_mpc_address(&mut self, address: Address) {
        self.mpc_address = Some(address);
    }

    pub fn get_mpc_address(&self) -> Option<Address> {
        self.mpc_address
    }

    pub fn hash_typed_data(&self, proposals: &[Proposal]) -> Result<H256, BridgeError> {
        let mut keccak_data = Vec::with_capacity(proposals.len());
        
        // Hash each proposal
        for proposal in proposals {
            // This is a simplified version - in a real implementation we'd need proper 
            // keccak256 hashing that matches Solidity's behavior
            let data_hash = H256::from_slice(
                &Sha256::new()
                    .chain_update(PROPOSAL_TYPE_HASH.as_bytes())
                    .chain_update(&[proposal.origin_domain_id])
                    .chain_update(&proposal.deposit_nonce.to_be_bytes())
                    .chain_update(proposal.resource_id.as_bytes())
                    .chain_update(&proposal.data)
                    .finalize()
            );
            keccak_data.push(data_hash);
        }
        
        // Hash the array of hashes
        let proposals_hash = H256::from_slice(
            &Sha256::new()
                .chain_update(PROPOSALS_TYPE_HASH.as_bytes())
                .chain_update(&keccak_data.iter().flat_map(|h| h.as_bytes()).cloned().collect::<Vec<u8>>())
                .finalize()
        );
        
        // Combine with domain separator
        let typed_hash = H256::from_slice(
            &Sha256::new()
                .chain_update(self.domain_separator.as_bytes())
                .chain_update(proposals_hash.as_bytes())
                .finalize()
        );
        
        Ok(typed_hash)
    }

    pub fn verify(&self, proposals: &[Proposal], _signature: &Bytes) -> Result<bool, BridgeError> {
        let mpc_address = self.mpc_address.ok_or(BridgeError::MPCAddressNotSet)?;
        
        let _hash = self.hash_typed_data(proposals)?;
        
        // In a real implementation, we'd need to recover the signer from the signature
        // and compare with MPC address. This is simplified:
        let recovered_address = Address::zero(); // Placeholder for recovered address
        
        Ok(recovered_address == mpc_address)
    }
}