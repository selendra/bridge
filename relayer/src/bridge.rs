use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use ethers::types::{Address, Bytes, H256, U256};
use tokio::sync::broadcast;

use crate::error::BridgeError;
use crate::traits::{Handler, FeeHandler, AccessControl};
use crate::types::{Proposal, DepositRecord, ExecutionRecord, DepositStatus, ChainConfig};
use crate::utils::{Pausable, crypto::BridgeCrypto};

/// Core bridge implementation that handles cross-chain communication
pub struct Bridge {
    /// Domain ID of the current chain
    domain_id: u8,
    /// Pausable state for the bridge
    pausable: Arc<Pausable>,
    /// Cryptographic utilities for the bridge
    crypto: Arc<RwLock<BridgeCrypto>>,
    /// Access control for administrative functions
    access_control: Arc<dyn AccessControl + Send + Sync>,
    /// Fee handler for cross-chain transactions
    fee_handler: Option<Arc<dyn FeeHandler + Send + Sync>>,
    /// Map of resource IDs to handler addresses
    resource_handlers: Arc<RwLock<HashMap<H256, Arc<dyn Handler + Send + Sync>>>>,
    /// Map of chain domain IDs to deposit counts
    deposit_counts: Arc<RwLock<HashMap<u8, u64>>>,
    /// Map of valid forwarders
    valid_forwarders: Arc<RwLock<HashMap<Address, bool>>>,
    /// Map of used nonces for each domain
    used_nonces: Arc<RwLock<HashMap<u8, HashMap<u64, u64>>>>,
    /// Storage for deposit records
    deposits: Arc<RwLock<Vec<DepositRecord>>>,
    /// Storage for execution records
    executions: Arc<RwLock<Vec<ExecutionRecord>>>,
    /// Channel for deposit events
    deposit_events: broadcast::Sender<DepositRecord>,
    /// Channel for execution events
    execution_events: broadcast::Sender<ExecutionRecord>,
    /// Chain configurations
    chain_configs: Arc<RwLock<HashMap<u8, ChainConfig>>>,
}

impl Bridge {
    /// Create a new bridge instance
    pub fn new(
        domain_id: u8, 
        access_control: Arc<dyn AccessControl + Send + Sync>,
        initial_pauser: Address,
    ) -> Self {
        let (deposit_tx, _) = broadcast::channel(100);
        let (execution_tx, _) = broadcast::channel(100);
        
        Self {
            domain_id,
            pausable: Arc::new(Pausable::new(initial_pauser, true)),
            crypto: Arc::new(RwLock::new(BridgeCrypto::new("Bridge", "3.1.0"))),
            access_control,
            fee_handler: None,
            resource_handlers: Arc::new(RwLock::new(HashMap::new())),
            deposit_counts: Arc::new(RwLock::new(HashMap::new())),
            valid_forwarders: Arc::new(RwLock::new(HashMap::new())),
            used_nonces: Arc::new(RwLock::new(HashMap::new())),
            deposits: Arc::new(RwLock::new(Vec::new())),
            executions: Arc::new(RwLock::new(Vec::new())),
            deposit_events: deposit_tx,
            execution_events: execution_tx,
            chain_configs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Add a chain configuration
    pub fn add_chain_config(&self, config: ChainConfig) {
        let mut configs = self.chain_configs.write().unwrap();
        configs.insert(config.domain_id, config);
    }

    /// Set the fee handler
    pub fn set_fee_handler(&mut self, fee_handler: Arc<dyn FeeHandler + Send + Sync>) {
        self.fee_handler = Some(fee_handler);
    }

    /// Admin function to pause transfers
    pub async fn admin_pause_transfers(&self, sender: Address) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x80, 0xf0, 0x1a, 0xc8], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_pause_transfers".to_string(),
            });
        }

        self.pausable.pause(sender).map_err(|e| BridgeError::HandlerExecutionFailed(e.to_string()))
    }

    /// Admin function to unpause transfers
    pub async fn admin_unpause_transfers(&self, sender: Address) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x70, 0xbc, 0xac, 0x5d], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_unpause_transfers".to_string(),
            });
        }

        // Check if MPC address is set
        let crypto = self.crypto.read().unwrap();
        if crypto.get_mpc_address().is_none() {
            return Err(BridgeError::MPCAddressNotSet);
        }

        self.pausable.unpause(sender).map_err(|e| BridgeError::HandlerExecutionFailed(e.to_string()))
    }

    /// Set a resource for a handler
    pub async fn admin_set_resource(
        &self,
        sender: Address,
        handler_address: Arc<dyn Handler + Send + Sync>,
        resource_id: H256,
        contract_address: Address,
        args: Bytes,
    ) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0xc8, 0x81, 0xf5, 0x40], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_set_resource".to_string(),
            });
        }

        // Set resource in handler - use the Arc directly, no need for mutability
        handler_address.set_resource(resource_id, contract_address, args).await?;

        // Register the resource -> handler mapping
        let mut handlers = self.resource_handlers.write().unwrap();
        handlers.insert(resource_id, handler_address);

        Ok(())
    }

    /// Allow tokens to be burned
    pub async fn admin_set_burnable(
        &self,
        sender: Address,
        _handler_address: Arc<dyn Handler + Send + Sync>,
        token_address: Address,
    ) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x5a, 0x1c, 0xb1, 0x01], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_set_burnable".to_string(),
            });
        }

        // In a real implementation, we would call setBurnable on the handler
        // Here we'll just log it
        println!("Setting token {:?} as burnable in handler", token_address);

        Ok(())
    }

    /// Set the deposit nonce for a domain
    pub async fn admin_set_deposit_nonce(
        &self,
        sender: Address,
        domain_id: u8,
        nonce: u64,
    ) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x7f, 0xb8, 0x75, 0xbe], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_set_deposit_nonce".to_string(),
            });
        }

        let mut deposit_counts = self.deposit_counts.write().unwrap();
        let current_nonce = deposit_counts.entry(domain_id).or_insert(0);

        if nonce <= *current_nonce {
            return Err(BridgeError::NonceDecrementsNotAllowed);
        }

        *current_nonce = nonce;
        Ok(())
    }

    /// Set a valid forwarder
    pub async fn admin_set_forwarder(
        &self,
        sender: Address,
        forwarder: Address,
        valid: bool,
    ) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x45, 0xb8, 0x3c, 0x61], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_set_forwarder".to_string(),
            });
        }

        let mut forwarders = self.valid_forwarders.write().unwrap();
        forwarders.insert(forwarder, valid);

        Ok(())
    }

    /// Change the access control contract
    pub async fn admin_change_access_control(
        &mut self,
        sender: Address,
        new_access_control: Arc<dyn AccessControl + Send + Sync>,
    ) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x9d, 0xde, 0xbc, 0xa4], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_change_access_control".to_string(),
            });
        }

        self.access_control = new_access_control;
        println!("AccessControlChanged event emitted");

        Ok(())
    }

    /// Change the fee handler
    pub async fn admin_change_fee_handler(
        &mut self,
        sender: Address,
        new_fee_handler: Arc<dyn FeeHandler + Send + Sync>,
    ) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x4b, 0x05, 0x44, 0xc6], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_change_fee_handler".to_string(),
            });
        }

        self.fee_handler = Some(new_fee_handler);
        println!("FeeHandlerChanged event emitted");

        Ok(())
    }

    /// Withdraw funds from ERC safes
    pub async fn admin_withdraw(
        &self,
        sender: Address,
        _handler_address: Arc<dyn Handler + Send + Sync>,
        data: Bytes,
    ) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x0d, 0x29, 0xd2, 0x32], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "admin_withdraw".to_string(),
            });
        }

        // In a real implementation, we would call withdraw on the handler
        // Here we'll just log it
        println!("Withdrawing from handler with data: {:?}", data);

        Ok(())
    }

    /// Start the keygen process
    pub async fn start_keygen(&self, sender: Address) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x67, 0x54, 0x19, 0xb1], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "start_keygen".to_string(),
            });
        }

        // Check if MPC address is already set
        let crypto = self.crypto.read().unwrap();
        if crypto.get_mpc_address().is_some() {
            return Err(BridgeError::MPCAddressAlreadySet);
        }

        // In a real implementation, we would emit an event here
        // to trigger the keygen process on the MPC side
        println!("StartKeygen event emitted");

        Ok(())
    }

    /// End the keygen process and set MPC address
    pub async fn end_keygen(&self, sender: Address, mpc_address: Address) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x63, 0x7f, 0x7a, 0x1e], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "end_keygen".to_string(),
            });
        }

        if mpc_address == Address::zero() {
            return Err(BridgeError::MPCAddressZeroAddress);
        }

        // Check if MPC address is already set
        let mut crypto = self.crypto.write().unwrap();
        if crypto.get_mpc_address().is_some() {
            return Err(BridgeError::MPCAddressIsNotUpdatable);
        }

        // Set MPC address
        crypto.set_mpc_address(mpc_address);
        
        // Unpause the bridge
        self.pausable.unpause(sender).map_err(|e| BridgeError::HandlerExecutionFailed(e.to_string()))?;
        
        // In a real implementation, we would emit an event here
        println!("EndKeygen event emitted");

        Ok(())
    }
    
    /// Refresh MPC keys
    pub async fn refresh_key(&self, sender: Address, hash: String) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x76, 0x88, 0x72, 0x82], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "refresh_key".to_string(),
            });
        }

        println!("KeyRefresh event emitted with hash: {}", hash);
        Ok(())
    }

    /// Retry failed deposits
    pub async fn retry(&self, sender: Address, tx_hash: String) -> Result<(), BridgeError> {
        // Check access
        if !self.access_control.has_access([0x8c, 0xc9, 0x87, 0xf8], sender).await {
            return Err(BridgeError::AccessNotAllowed {
                sender: format!("{:?}", sender),
                function: "retry".to_string(), 
            });
        }

        println!("Retry event emitted with txHash: {}", tx_hash);
        Ok(())
    }

    /// Initiate a deposit to another chain
    pub async fn deposit(
        &self,
        sender: Address,
        destination_domain_id: u8,
        resource_id: H256,
        deposit_data: Bytes,
        fee_data: Bytes,
        value: U256,
    ) -> Result<(u64, Bytes), BridgeError> {
        // Check if bridge is paused
        if self.pausable.is_paused() {
            return Err(BridgeError::BridgePaused);
        }

        // Check if destination is current domain
        if destination_domain_id == self.domain_id {
            return Err(BridgeError::DepositToCurrentDomain);
        }

        // Collect fee if fee handler is set
        if let Some(fee_handler) = &self.fee_handler {
            fee_handler.collect_fee(
                sender,
                self.domain_id,
                destination_domain_id,
                resource_id,
                deposit_data.clone(),
                fee_data,
                value,
            ).await?;
        } else if value > U256::zero() {
            return Err(BridgeError::HandlerExecutionFailed("No FeeHandler, value must be zero".to_string()));
        }

        // Check if resource has a handler
        let handlers = self.resource_handlers.read().unwrap();
        let handler = handlers.get(&resource_id).ok_or(BridgeError::ResourceIDNotMappedToHandler)?;

        // Increment deposit count for destination domain
        let mut deposit_counts = self.deposit_counts.write().unwrap();
        let deposit_nonce = {
            let count = deposit_counts.entry(destination_domain_id).or_insert(0);
            *count += 1;
            *count
        };

        // Call deposit on the handler
        let handler_response = handler.deposit(resource_id, sender, deposit_data.clone()).await?;

        // Create deposit record
        let deposit_record = DepositRecord {
            destination_domain_id,
            resource_id,
            deposit_nonce,
            sender,
            receiver: Address::zero(), // Placeholder - would extract from deposit_data
            token_address: None,       // Placeholder - would extract from deposit_data
            amount: None,              // Placeholder - would extract from deposit_data
            timestamp: chrono::Utc::now().timestamp() as u64,
            transaction_hash: H256::zero(), // Placeholder - would be actual transaction hash
            status: DepositStatus::Pending,
        };

        // Store deposit record
        {
            let mut deposits = self.deposits.write().unwrap();
            deposits.push(deposit_record.clone());
        }

        // Emit deposit event
        let _ = self.deposit_events.send(deposit_record);
        
        // In a real implementation, we would emit a contract event
        println!(
            "Deposit event emitted: destination={}, resourceId={:?}, nonce={}, sender={:?}", 
            destination_domain_id, resource_id, deposit_nonce, sender
        );

        Ok((deposit_nonce, handler_response))
    }

    /// Execute a single proposal
    pub async fn execute_proposal(
        &self,
        proposal: Proposal,
        signature: Bytes,
    ) -> Result<Bytes, BridgeError> {
        let proposals = vec![proposal];
        self.execute_proposals(proposals, signature).await
    }

    /// Execute multiple proposals
    pub async fn execute_proposals(
        &self,
        proposals: Vec<Proposal>,
        signature: Bytes,
    ) -> Result<Bytes, BridgeError> {
        // Check if bridge is paused
        if self.pausable.is_paused() {
            return Err(BridgeError::BridgePaused);
        }

        // Check if proposals array is empty
        if proposals.is_empty() {
            return Err(BridgeError::EmptyProposalsArray);
        }

        // Verify signature
        let crypto = self.crypto.read().unwrap();
        if !crypto.verify(&proposals, &signature)? {
            return Err(BridgeError::InvalidProposalSigner);
        }

        let mut results = Vec::new();

        for proposal in proposals {
            // Check if proposal has already been executed
            if self.is_proposal_executed(proposal.origin_domain_id, proposal.deposit_nonce)? {
                continue;
            }

            // Get the handler for this resource
            let handlers = self.resource_handlers.read().unwrap();
            let handler = handlers.get(&proposal.resource_id).ok_or(BridgeError::ResourceIDNotMappedToHandler)?;

            // Mark proposal as executed
            {
                let mut used_nonces = self.used_nonces.write().unwrap();
                let domain_nonces = used_nonces.entry(proposal.origin_domain_id).or_insert_with(HashMap::new);
                let nonce_page = domain_nonces.entry(proposal.deposit_nonce / 256).or_insert(0);
                *nonce_page |= 1 << (proposal.deposit_nonce % 256);
            }

            match handler.execute_proposal(proposal.resource_id, proposal.data.clone()).await {
                Ok(response) => {
                    // Create execution record
                    let execution_record = ExecutionRecord {
                        origin_domain_id: proposal.origin_domain_id,
                        deposit_nonce: proposal.deposit_nonce,
                        resource_id: proposal.resource_id,
                        status: DepositStatus::Executed,
                        execution_transaction_hash: Some(H256::zero()), // Placeholder
                        execution_timestamp: Some(chrono::Utc::now().timestamp() as u64),
                        error_message: None,
                    };
            
                    // Store execution record
                    {
                        let mut executions = self.executions.write().unwrap();
                        executions.push(execution_record.clone());
                    }
            
                    // Emit execution event
                    let _ = self.execution_events.send(execution_record);
            
                    // Use ethers::types::H256 for keccak256 hash calculation
                    let data_hash = ethers::utils::keccak256(proposal.data.as_ref());
                    let data_hash = H256::from_slice(&data_hash);
                    
                    println!(
                        "ProposalExecution event emitted: origin={}, nonce={}, dataHash={:?}",
                        proposal.origin_domain_id, proposal.deposit_nonce, data_hash
                    );
            
                    results.push(response);
                },
                Err(e) => {
                    // Remove proposal from executed
                    {
                        let mut used_nonces = self.used_nonces.write().unwrap();
                        let domain_nonces = used_nonces.entry(proposal.origin_domain_id).or_insert_with(HashMap::new);
                        let nonce_page = domain_nonces.entry(proposal.deposit_nonce / 256).or_insert(0);
                        *nonce_page &= !(1 << (proposal.deposit_nonce % 256));
                    }

                    // Create failed execution record
                    let execution_record = ExecutionRecord {
                        origin_domain_id: proposal.origin_domain_id,
                        deposit_nonce: proposal.deposit_nonce,
                        resource_id: proposal.resource_id,
                        status: DepositStatus::Failed,
                        execution_transaction_hash: None,
                        execution_timestamp: Some(chrono::Utc::now().timestamp() as u64),
                        error_message: Some(e.to_string()),
                    };

                    // Store execution record
                    {
                        let mut executions = self.executions.write().unwrap();
                        executions.push(execution_record.clone());
                    }

                    // Emit execution event
                    let _ = self.execution_events.send(execution_record);

                    println!(
                        "FailedHandlerExecution event emitted: origin={}, nonce={}",
                        proposal.origin_domain_id, proposal.deposit_nonce
                    );

                    // Continue to the next proposal
                    continue;
                }
            }
        }

        // Return combined results
        Ok(Bytes::from(results.into_iter().fold(Vec::new(), |mut acc, x| {
            acc.extend_from_slice(&x);
            acc
        })))
    }

    /// Check if a proposal has been executed
    pub fn is_proposal_executed(&self, domain_id: u8, deposit_nonce: u64) -> Result<bool, BridgeError> {
        let used_nonces = self.used_nonces.read().unwrap();
        
        if let Some(domain_nonces) = used_nonces.get(&domain_id) {
            if let Some(nonce_page) = domain_nonces.get(&(deposit_nonce / 256)) {
                return Ok((nonce_page & (1 << (deposit_nonce % 256))) != 0);
            }
        }
        
        Ok(false)
    }

    /// Get a subscriber for deposit events
    pub fn subscribe_to_deposits(&self) -> broadcast::Receiver<DepositRecord> {
        self.deposit_events.subscribe()
    }

    /// Get a subscriber for execution events
    pub fn subscribe_to_executions(&self) -> broadcast::Receiver<ExecutionRecord> {
        self.execution_events.subscribe()
    }
    
    /// Get current domain ID
    pub fn get_domain_id(&self) -> u8 {
        self.domain_id
    }
    
    /// Get MPC address if set
    pub fn get_mpc_address(&self) -> Option<Address> {
        let crypto = self.crypto.read().unwrap();
        crypto.get_mpc_address()
    }
    
    /// Get deposit count for a domain
    pub fn get_deposit_count(&self, domain_id: u8) -> u64 {
        let deposit_counts = self.deposit_counts.read().unwrap();
        *deposit_counts.get(&domain_id).unwrap_or(&0)
    }
}