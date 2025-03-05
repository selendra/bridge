use clap::{Parser, Subcommand};
use ethers::types::{Address, H256, U256, Bytes};
use relayer::{bridge::Bridge, error::BridgeError, handler::ERC20Handler, traits::{AccessControl, FeeHandler}, types::{ChainConfig, Proposal}};
use std::sync::Arc;

/// Command-line interface for the Multichain Bridge
#[derive(Parser)]
#[clap(name = "Multichain Bridge CLI")]
#[clap(about = "Command line tool for interacting with the Multichain Bridge", long_about = None)]
struct Cli {
    #[clap(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Make a deposit to another chain
    Deposit {
        #[clap(long)]
        destination_domain_id: u8,
        #[clap(long)]
        resource_id: String,
        #[clap(long)]
        deposit_data: String,
        #[clap(long)]
        fee_data: String,
        #[clap(long)]
        value: u64,
    },
    /// Execute a proposal
    ExecuteProposal {
        #[clap(long)]
        origin_domain_id: u8,
        #[clap(long)]
        deposit_nonce: u64,
        #[clap(long)]
        resource_id: String,
        #[clap(long)]
        data: String,
        #[clap(long)]
        signature: String,
    },
}

#[tokio::main]
async fn main() -> Result<(), BridgeError> {
    let args = Cli::parse();

    // Initialize bridge components
    let access_control = Arc::new(DummyAccessControl {});
    let _fee_handler = Arc::new(DummyFeeHandler {});
    let bridge = Arc::new(Bridge::new(1, access_control.clone(), Address::zero()));

    // Add dummy handlers and chain configurations
    let erc20_handler = Arc::new(ERC20Handler::new(Address::zero()));
    bridge.admin_set_resource(Address::zero(), erc20_handler.clone(), H256::zero(), Address::zero(), Bytes::new()).await?;
    
    // Dummy chain configuration
    let chain_config = ChainConfig {
        domain_id: 1,
        name: "Chain1".to_string(),
        rpc_url: "http://localhost:8545".to_string(),
        bridge_address: Address::zero(),
        chain_id: 1,
        confirmations: 1,
        gas_limit: U256::zero(),
        max_gas_price: U256::zero(),
        handlers: Default::default(),
    };
    bridge.add_chain_config(chain_config);

    match args.command {
        Commands::Deposit {
            destination_domain_id,
            resource_id,
            deposit_data,
            fee_data,
            value,
        } => {
            let resource_id = H256::from_slice(&hex::decode(resource_id).unwrap());
            let deposit_data = Bytes::from(hex::decode(deposit_data).unwrap());
            let fee_data = Bytes::from(hex::decode(fee_data).unwrap());
            let value = U256::from(value);

            let (deposit_nonce, handler_response) = bridge.deposit(
                Address::zero(),
                destination_domain_id,
                resource_id,
                deposit_data,
                fee_data,
                value,
            ).await?;

            println!("Deposit successful: nonce = {}, response = {:?}", deposit_nonce, handler_response);
        }
        Commands::ExecuteProposal {
            origin_domain_id,
            deposit_nonce,
            resource_id,
            data,
            signature,
        } => {
            let resource_id = H256::from_slice(&hex::decode(resource_id).unwrap());
            let data = Bytes::from(hex::decode(data).unwrap());
            let signature = Bytes::from(hex::decode(signature).unwrap());

            let proposal = Proposal {
                origin_domain_id,
                deposit_nonce,
                resource_id,
                data,
            };

            let handler_response = bridge.execute_proposal(proposal, signature).await?;

            println!("Proposal executed successfully: response = {:?}", handler_response);
        }
    }

    Ok(())
}

/// Dummy implementation of AccessControl for demonstration purposes
struct DummyAccessControl;

#[async_trait::async_trait]
impl AccessControl for DummyAccessControl {
    async fn has_access(&self, _function_signature: [u8; 4], _caller: Address) -> bool {
        true
    }
}

/// Dummy implementation of FeeHandler for demonstration purposes
struct DummyFeeHandler;

#[async_trait::async_trait]
impl FeeHandler for DummyFeeHandler {
    async fn collect_fee(
        &self,
        _sender: Address,
        _source_domain_id: u8,
        _destination_domain_id: u8,
        _resource_id: H256,
        _deposit_data: Bytes,
        _fee_data: Bytes,
        _value: U256,
    ) -> Result<(), BridgeError> {
        Ok(())
    }

    async fn calculate_fee(
        &self,
        _source_domain_id: u8,
        _destination_domain_id: u8,
        _resource_id: H256,
        _deposit_data: Bytes,
        _fee_data: Bytes,
    ) -> Result<U256, BridgeError> {
        Ok(U256::zero())
    }
}