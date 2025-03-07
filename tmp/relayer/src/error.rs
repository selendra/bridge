use thiserror::Error;

#[derive(Error, Debug)]
pub enum BridgeError {
    #[error("Access not allowed for {sender:?} to call {function:?}")]
    AccessNotAllowed { sender: String, function: String },

    #[error("Resource ID not mapped to handler")]
    ResourceIDNotMappedToHandler,

    #[error("Cannot deposit to current domain")]
    DepositToCurrentDomain,

    #[error("Invalid proposal signer")]
    InvalidProposalSigner,

    #[error("Empty proposals array")]
    EmptyProposalsArray,

    #[error("Nonce decrements are not allowed")]
    NonceDecrementsNotAllowed,

    #[error("MPC address already set")]
    MPCAddressAlreadySet,

    #[error("MPC address not set")]
    MPCAddressNotSet,

    #[error("MPC address is not updatable")]
    MPCAddressIsNotUpdatable,

    #[error("MPC address cannot be zero address")]
    MPCAddressZeroAddress,

    #[error("Bridge is paused")]
    BridgePaused,

    #[error("Cryptographic error: {0}")]
    CryptoError(String),

    #[error("Chain connection error: {0}")]
    ChainConnectionError(String),

    #[error("Handler execution failed: {0}")]
    HandlerExecutionFailed(String),
}