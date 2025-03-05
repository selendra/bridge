use std::sync::atomic::{AtomicBool, Ordering};
use ethers::types::Address;

/// Pausable functionality for the bridge
pub struct Pausable {
    paused: AtomicBool,
    pauser: Address,
}

impl Pausable {
    pub fn new(initial_pauser: Address, initial_state: bool) -> Self {
        Self {
            paused: AtomicBool::new(initial_state),
            pauser: initial_pauser,
        }
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub fn pause(&self, actor: Address) -> Result<(), &'static str> {
        if actor != self.pauser {
            return Err("Only pauser can pause");
        }
        
        self.paused.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn unpause(&self, actor: Address) -> Result<(), &'static str> {
        if actor != self.pauser {
            return Err("Only pauser can unpause");
        }
        
        self.paused.store(false, Ordering::SeqCst);
        Ok(())
    }

    pub fn set_pauser(&mut self, new_pauser: Address) {
        self.pauser = new_pauser;
    }
}