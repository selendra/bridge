use async_trait::async_trait;
use ethers::types::Address;

/// Access control interface
#[async_trait]
pub trait AccessControl {
    /// Checks if an address has access to call a specific function
    async fn has_access(&self, function_signature: [u8; 4], caller: Address) -> bool;
}