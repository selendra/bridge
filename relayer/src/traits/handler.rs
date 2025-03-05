use async_trait::async_trait;
use ethers::types::{Address, Bytes, H256, U256};

use crate::error::BridgeError;

/// Handler trait for resource-specific operations
#[async_trait]
pub trait Handler: Send + Sync {
    /// Sets a resource for the handler using interior mutability
    async fn set_resource(&self, resource_id: H256, contract_address: Address, args: Bytes) -> Result<(), BridgeError>;

    /// Handles a deposit for the specified resource
    async fn deposit(&self, resource_id: H256, sender: Address, data: Bytes) -> Result<Bytes, BridgeError>;

    /// Executes a proposal for the specified resource
    async fn execute_proposal(&self, resource_id: H256, data: Bytes) -> Result<Bytes, BridgeError>;
}

/// Fee handler for managing transaction fees
#[async_trait]
pub trait FeeHandler {
    /// Collects fee for a cross-chain transaction
    async fn collect_fee(
        &self,
        sender: Address,
        source_domain_id: u8,
        destination_domain_id: u8,
        resource_id: H256,
        deposit_data: Bytes,
        fee_data: Bytes,
        value: U256,
    ) -> Result<(), BridgeError>;

    /// Calculates the fee for a cross-chain transaction
    async fn calculate_fee(
        &self,
        source_domain_id: u8,
        destination_domain_id: u8,
        resource_id: H256,
        deposit_data: Bytes,
        fee_data: Bytes,
    ) -> Result<U256, BridgeError>;
}