use anyhow::{anyhow, Result};
use pbkdf2::{hmac::Hmac, pbkdf2};
use security_framework::passwords::get_generic_password;
use sha1::Sha1;

use crate::chromium::{BrowserConfig, CryptoService, LocalState};

mod util;

//
// Public API
//

pub const SUPPORTED_BROWSERS: [BrowserConfig; 3] = [
    BrowserConfig {
        name: "Chrome",
        data_dir: "Library/Application Support/Google/Chrome",
    },
    BrowserConfig {
        name: "Edge",
        data_dir: "Library/Application Support/Microsoft/Edge",
    },
    BrowserConfig {
        name: "Brave",
        data_dir: "Library/Application Support/BraveSoftware/Brave-Browser",
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

//
// Private
//

#[derive(Debug)]
struct KeychainConfig {
    browser: &'static str,
    service: &'static str,
    account: &'static str,
}

const KEYCHAIN_CONFIG: [KeychainConfig; 3] = [
    KeychainConfig {
        browser: "Chrome",
        service: "Chrome Safe Storage",
        account: "Chrome",
    },
    KeychainConfig {
        browser: "Edge",
        service: "Microsoft Edge Safe Storage",
        account: "Microsoft Edge",
    },
    KeychainConfig {
        browser: "Brave",
        service: "Brave Safe Storage",
        account: "Brave",
    },
];

//
// CryptoService
//

struct MacCryptoService {
    master_key: Option<Vec<u8>>,
    config: &'static KeychainConfig,
}

impl MacCryptoService {
    const IV: [u8; 16] = [0x20; 16]; // 16 bytes of 0x20 (space character)

    fn new(config: &'static KeychainConfig) -> Self {
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
        let password = get_generic_password(self.config.service, self.config.account)
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
