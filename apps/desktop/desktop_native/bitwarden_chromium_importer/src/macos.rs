use anyhow::{anyhow, Result};
use async_trait::async_trait;
use security_framework::passwords::get_generic_password;

use crate::chromium::{BrowserConfig, CryptoService, LocalState};

mod util;

//
// Public API
//

pub const SUPPORTED_BROWSERS: [BrowserConfig; 7] = [
    BrowserConfig {
        name: "Chrome",
        data_dir: "Library/Application Support/Google/Chrome",
    },
    BrowserConfig {
        name: "Chromium",
        data_dir: "Library/Application Support/Chromium",
    },
    BrowserConfig {
        name: "Microsoft Edge",
        data_dir: "Library/Application Support/Microsoft Edge",
    },
    BrowserConfig {
        name: "Brave",
        data_dir: "Library/Application Support/BraveSoftware/Brave-Browser",
    },
    BrowserConfig {
        name: "Arc",
        data_dir: "Library/Application Support/Arc/User Data",
    },
    BrowserConfig {
        name: "Opera",
        data_dir: "Library/Application Support/com.operasoftware.Opera",
    },
    BrowserConfig {
        name: "Vivaldi",
        data_dir: "Library/Application Support/Vivaldi",
    },
];

pub fn get_crypto_service(
    browser_name: &String,
    _local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    let config = KEYCHAIN_CONFIG
        .iter()
        .find(|b| b.browser == browser_name)
        .ok_or_else(|| anyhow!("Unsupported browser: {}", browser_name))?;

    Ok(Box::new(MacCryptoService::new(config)))
}

pub fn configure_windows_crypto_service(_admin_exe_path: &String) {
    // Do nothing on macOS
}

//
// Private
//

#[derive(Debug)]
struct KeychainConfig {
    browser: &'static str,
    service: &'static str,
    account: &'static str,
}

const KEYCHAIN_CONFIG: [KeychainConfig; SUPPORTED_BROWSERS.len()] = [
    KeychainConfig {
        browser: "Chrome",
        service: "Chrome Safe Storage",
        account: "Chrome",
    },
    KeychainConfig {
        browser: "Chromium",
        service: "Chromium Safe Storage",
        account: "Chromium",
    },
    KeychainConfig {
        browser: "Microsoft Edge",
        service: "Microsoft Edge Safe Storage",
        account: "Microsoft Edge",
    },
    KeychainConfig {
        browser: "Brave",
        service: "Brave Safe Storage",
        account: "Brave",
    },
    KeychainConfig {
        browser: "Arc",
        service: "Arc Safe Storage",
        account: "Arc",
    },
    KeychainConfig {
        browser: "Opera",
        service: "Opera Safe Storage",
        account: "Opera",
    },
    KeychainConfig {
        browser: "Vivaldi",
        service: "Vivaldi Safe Storage",
        account: "Vivaldi",
    },
];

const IV: [u8; 16] = [0x20; 16]; // 16 bytes of 0x20 (space character)

//
// CryptoService
//

struct MacCryptoService {
    config: &'static KeychainConfig,
    master_key: Option<Vec<u8>>,
}

impl MacCryptoService {
    fn new(config: &'static KeychainConfig) -> Self {
        Self {
            config,
            master_key: None,
        }
    }
}

#[async_trait]
impl CryptoService for MacCryptoService {
    async fn decrypt_to_string(&mut self, encrypted: &[u8]) -> Result<String> {
        if encrypted.is_empty() {
            return Ok(String::new());
        }

        // On macOS only v10 is supported
        let (_, no_prefix) = util::split_encrypted_string_and_validate(encrypted, &["v10"])?;

        // This might bring up the admin password prompt
        if self.master_key.is_none() {
            self.master_key = Some(get_master_key(self.config.service, self.config.account)?);
        }

        let key = self
            .master_key
            .as_ref()
            .ok_or_else(|| anyhow!("Failed to retrieve key"))?;
        let plaintext = util::decrypt_aes_128_cbc(key, &IV, no_prefix)
            .map_err(|e| anyhow!("Failed to decrypt: {}", e))?;
        let plaintext =
            String::from_utf8(plaintext).map_err(|e| anyhow!("Invalid UTF-8: {}", e))?;

        Ok(plaintext)
    }
}

fn get_master_key(service: &str, account: &str) -> Result<Vec<u8>> {
    let master_password = get_master_password(service, account)?;
    let key = util::derive_saltysalt(&master_password, 1003)?;
    Ok(key)
}

fn get_master_password(service: &str, account: &str) -> Result<Vec<u8>> {
    let password = get_generic_password(service, account)
        .map_err(|e| anyhow!("Failed to get password from keychain: {}", e))?;

    Ok(password)
}
