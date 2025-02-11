use ethers::{
    abi::Token, prelude::*, providers::{Http, Provider}, signers::Signer
};
use std::sync::Arc;
use eyre::Result;
use bridge_config::bridge_contract::{Bridge, TokensLockedFilter};

pub struct BridgeRelayer {
    pub source_provider: Arc<Provider<Http>>,
    pub target_provider: Arc<Provider<Http>>,
    pub bridge_contract: Address,
    pub wallet: LocalWallet,
}

impl BridgeRelayer {
    pub fn new(
        source_rpc: &str,
        target_rpc: &str,
        bridge_contract: Address,
        private_key: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let source_provider = Arc::new(Provider::<Http>::try_from(source_rpc)?);
        let target_provider = Arc::new(Provider::<Http>::try_from(target_rpc)?);
        let wallet = private_key.parse::<LocalWallet>()?;

        Ok(Self {
            source_provider,
            target_provider,
            bridge_contract,
            wallet,
        })
    }

    pub async fn listen_for_events(&self) -> Result<(), Box<dyn std::error::Error>> {
        let bridge_contract = Bridge::new(self.bridge_contract, self.source_provider.clone());
        
        let filter = bridge_contract.event::<TokensLockedFilter>();

        let mut stream = filter.stream().await?;

        while let Some(event) = stream.next().await {
            match event {
                Ok(log) => {
                    self.process_lock_event(log).await?;
                }
                Err(e) => {
                    eprintln!("Error processing event: {:?}", e);
                }
            }
        }
        Ok(())
    }

    pub async fn process_lock_event(&self, event: TokensLockedFilter) -> Result<(), Box<dyn std::error::Error>> {
        let token = event.token;
        let from = event.from;
        let amount = event.amount;
        let nonce = event.nonce;

        let message = ethers::utils::keccak256(&ethers::abi::encode(&[
            Token::Address(token),
            Token::Address(from),
            Token::Uint(amount),
            Token::Uint(nonce.into()),
        ]));

         // Sign message
         let signature = self.wallet.sign_message(&message).await?;

         // Submit unlock transaction on target chain
         let bridge_contract = Bridge::new(self.bridge_contract, self.target_provider.clone());
         let unlock_tx = bridge_contract
             .unlock_tokens(token, from, amount, nonce, signature.to_vec().into())
             .from(self.wallet.address());
 
         let pending_tx = unlock_tx.send().await?;
         if let Some(receipt) = pending_tx.await? {
             println!(
                 "Processed bridge transaction: {:?}",
                 receipt.transaction_hash
             );
         } else {
             println!("Transaction failed.");
         }
 
         Ok(())
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        println!("Starting bridge relayer...");
        self.listen_for_events().await
    }
}

