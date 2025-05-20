use crate::chromium::{CryptoService, LocalState};
use anyhow::{Result, anyhow};
use std::path::PathBuf;

//
// Public API
//

pub fn get_supported_browsers() -> Vec<String> {
    vec![]
}

pub fn get_browser_settings_directory(_browser_name: &String) -> Result<PathBuf> {
    Err(anyhow!("Not implemented on Linux"))
}

pub fn get_crypto_service(
    _browser_name: &String,
    _local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    let service = LinuxCryptoService::new(_local_state);
    Ok(Box::new(service))
}

//
// Private
//

struct LinuxCryptoService {}

impl LinuxCryptoService {
    fn new(_local_state: &LocalState) -> Self {
        Self {}
    }
}

impl CryptoService for LinuxCryptoService {
    fn decrypt_to_string(&mut self, _encrypted: &[u8]) -> Result<String> {
        Err(anyhow!("Linux decryption not implemented".to_string()))
    }
}
