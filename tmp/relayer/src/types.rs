use ethers::types::{Address, Bytes, H256, U256};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Configuration for a blockchain connected to the bridge
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChainConfig {
    pub domain_id: u8,
    pub name: String,
    pub rpc_url: String,
    pub bridge_address: Address,
    pub chain_id: u64,
    pub confirmations: u64,
    pub gas_limit: U256,
    pub max_gas_price: U256,
    pub handlers: HashMap<String, Address>,
}

/// Bridge proposal structure representing a cross-chain operation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Proposal {
    pub origin_domain_id: u8,
    pub deposit_nonce: u64,
    pub resource_id: H256,
    pub data: Bytes,
}

/// Status tracking for a deposit
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum DepositStatus {
    Pending,
    Executed,
    Failed,
}

/// Deposit record for tracking cross-chain transactions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DepositRecord {
    pub destination_domain_id: u8,
    pub resource_id: H256,
    pub deposit_nonce: u64,
    pub sender: Address,
    pub receiver: Address,
    pub token_address: Option<Address>,
    pub amount: Option<U256>,
    pub timestamp: u64,
    pub transaction_hash: H256,
    pub status: DepositStatus,
}

/// Execution record for deposits from other chains
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionRecord {
    pub origin_domain_id: u8,
    pub deposit_nonce: u64,
    pub resource_id: H256,
    pub status: DepositStatus,
    pub execution_transaction_hash: Option<H256>,
    pub execution_timestamp: Option<u64>,
    pub error_message: Option<String>,
}