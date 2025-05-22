use std::path::PathBuf;

use anyhow::{anyhow, Result};
use homedir::my_home;
use pbkdf2::{hmac::Hmac, pbkdf2};
use security_framework::passwords::get_generic_password;
use sha1::Sha1;

use crate::chromium::{CryptoService, LocalState};

mod util;

//
// Public API
//

pub fn get_supported_browsers() -> Vec<String> {
    SUPPORTED_BROWSERS
        .iter()
        .map(|b| b.name.to_string())
        .collect()
}

pub fn get_browser_settings_directory(browser_name: &String) -> Result<PathBuf> {
    let config = find_browser_config(&browser_name);
    if config.is_none() {
        return Err(anyhow!("Unsupported browser: {}", browser_name));
    }
    let config = config.unwrap();

    let path = my_home()
        .map_err(|_| anyhow!("Home directory not found"))?
        .ok_or_else(|| anyhow!("Home directory not found"))?;

    let path = path
        .join("Library/Application Support")
        .join(config.company)
        .join(config.product);
    Ok(path)
}

pub fn get_crypto_service(
    browser_name: &String,
    _local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    let config = find_browser_config(&browser_name);
    if config.is_none() {
        return Err(anyhow!("Unsupported browser: {}", browser_name));
    }
    let config = config.unwrap();

    let result = MacCryptoService::new(config);
    Ok(Box::new(result))
}

//
// Private
//

#[derive(Debug)]
struct BrowserConfig {
    name: &'static str,
    company: &'static str,
    product: &'static str,
    keychain_config: KeychainConfig,
}

#[derive(Debug)]
struct KeychainConfig {
    service: &'static str,
    account: &'static str,
}

const SUPPORTED_BROWSERS: [BrowserConfig; 3] = [
    BrowserConfig {
        name: "Chrome",
        company: "Google",
        product: "Chrome",
        keychain_config: KeychainConfig {
            service: "Chrome Safe Storage",
            account: "Chrome",
        },
    },
    BrowserConfig {
        name: "Edge",
        company: "Microsoft",
        product: "Edge",
        keychain_config: KeychainConfig {
            service: "Microsoft Edge Safe Storage",
            account: "Microsoft Edge",
        },
    },
    BrowserConfig {
        name: "Brave",
        company: "BraveSoftware",
        product: "Brave-Browser",
        keychain_config: KeychainConfig {
            service: "Brave Safe Storage",
            account: "Brave",
        },
    },
];

fn find_browser_config(browser_name: &str) -> Option<&'static BrowserConfig> {
    SUPPORTED_BROWSERS.iter().find(|b| b.name == browser_name)
}

//
// CryptoService
//

struct MacCryptoService {
    master_key: Option<Vec<u8>>,
    config: &'static BrowserConfig,
}

impl MacCryptoService {
    const IV: [u8; 16] = [0x20; 16]; // 16 bytes of 0x20 (space character)

    fn new(config: &'static BrowserConfig) -> Self {
        Self {
            master_key: None,
            config: config,
        }
    }

    fn get_master_key(&self) -> Result<Vec<u8>> {
        let master_password = self.get_master_password()?;
        let key = self.derive_key(&master_password)?;
        Ok(key)
    }

    fn get_master_password(&self) -> Result<Vec<u8>> {
        let password = get_generic_password(
            self.config.keychain_config.service,
            self.config.keychain_config.account,
        )
        .map_err(|e| anyhow!("Failed to get password from keychain: {}", e))?;

        Ok(password)
    }

    fn derive_key(&self, master_password: &[u8]) -> Result<Vec<u8>> {
        let iterations = 1003;
        let key_length = 16;
        let salt = b"saltysalt";

        let mut key = vec![0u8; key_length];
        pbkdf2::<Hmac<Sha1>>(master_password, salt, iterations, &mut key)
            .map_err(|e| anyhow!("Failed to derive key: {}", e))?;

        Ok(key)
    }
}

impl CryptoService for MacCryptoService {
    fn decrypt_to_string(&mut self, encrypted: &[u8]) -> Result<String> {
        if encrypted.is_empty() {
            return Ok(String::new());
        }

        // On macOS only v10 is supported
        let (_, no_prefix) = util::split_encrypted_string_and_validate(encrypted, &["v10"])?;

        // This might bring up the admin password prompt
        if self.master_key.is_none() {
            self.master_key = Some(self.get_master_key()?);
        }

        let plaintext =
            util::decrypt_aes_128_cbc(&self.master_key.as_ref().unwrap(), &Self::IV, no_prefix)
                .map_err(|e| anyhow!("Failed to decrypt: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| anyhow!("Invalid UTF-8: {}", e))
    }
}
