use async_trait::async_trait;
use ethers::types::{Address, Bytes, H256};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::error::BridgeError;
use crate::traits::Handler;

#[allow(dead_code)]
/// Handler for ERC20 token transfers
pub struct ERC20Handler {
    contract_address: Address,
    resource_contracts: Arc<RwLock<HashMap<H256, Address>>>,
    burnable_contracts: Arc<RwLock<HashMap<Address, bool>>>,
}

impl ERC20Handler {
    pub fn new(contract_address: Address) -> Self {
        Self {
            contract_address,
            resource_contracts: Arc::new(RwLock::new(HashMap::new())),
            burnable_contracts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn set_burnable(&self, token_address: Address) -> Result<(), BridgeError> {
        let mut burnable = self.burnable_contracts.write().unwrap();
        burnable.insert(token_address, true);
        Ok(())
    }
}

#[allow(unused_variables)]
#[async_trait]
impl Handler for ERC20Handler {
    async fn set_resource(&self, resource_id: H256, contract_address: Address, _args: Bytes) -> Result<(), BridgeError> {
        let mut resources = self.resource_contracts.write().unwrap();
        resources.insert(resource_id, contract_address);
        Ok(())
    }

    async fn deposit(&self, resource_id: H256, sender: Address, data: Bytes) -> Result<Bytes, BridgeError> {
        // Placeholder for ERC20 deposit logic
        // In a real implementation, this would:
        // 1. Parse the data to get amount and recipient
        // 2. Lock or burn tokens from sender
        Ok(Bytes::new())
    }

    async fn execute_proposal(&self, resource_id: H256, data: Bytes) -> Result<Bytes, BridgeError> {
        // Placeholder for ERC20 execution logic
        // In a real implementation, this would:
        // 1. Parse the data to get amount and recipient
        // 2. Mint or unlock tokens to recipient
        Ok(Bytes::new())
    }
}