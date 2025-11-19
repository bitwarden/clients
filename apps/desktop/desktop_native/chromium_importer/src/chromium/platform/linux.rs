use std::collections::HashMap;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use oo7::XDG_SCHEMA_ATTRIBUTE;

use crate::chromium::{BrowserConfig, CryptoService, LocalState};

use crate::util;

//
// Public API
//

// TODO: It's possible that there might be multiple possible data directories, depending on the installation method (e.g., snap, flatpak, etc.).
pub(crate) const SUPPORTED_BROWSERS: &[BrowserConfig] = &[
    BrowserConfig {
        name: "Chrome",
        data_dir: &[".config/google-chrome"],
    },
    BrowserConfig {
        name: "Chromium",
        data_dir: &["snap/chromium/common/chromium"],
    },
    BrowserConfig {
        name: "Brave",
        data_dir: &[
            "snap/brave/current/.config/BraveSoftware/Brave-Browser",
            ".config/BraveSoftware/Brave-Browser",
        ],
    },
    BrowserConfig {
        name: "Opera",
        data_dir: &["snap/opera/current/.config/opera", ".config/opera"],
    },
];

pub(crate) fn get_crypto_service(
    browser_name: &String,
    _local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    let config = KEYRING_CONFIG
        .iter()
        .find(|b| b.browser == browser_name)
        .ok_or_else(|| anyhow!("Unsupported browser: {}", browser_name))?;
    let service = LinuxCryptoService::new(config);
    Ok(Box::new(service))
}

//
// Private
//

#[derive(Debug)]
struct KeyringConfig {
    browser: &'static str,
    application_id: &'static str,
}

const KEYRING_CONFIG: [KeyringConfig; SUPPORTED_BROWSERS.len()] = [
    KeyringConfig {
        browser: "Chrome",
        application_id: "chrome",
    },
    KeyringConfig {
        browser: "Chromium",
        application_id: "chromium",
    },
    KeyringConfig {
        browser: "Brave",
        application_id: "brave",
    },
    KeyringConfig {
        browser: "Opera",
        application_id: "opera",
    },
];

const IV: [u8; 16] = [0x20; 16];
const V10_KEY: [u8; 16] = [
    0xfd, 0x62, 0x1f, 0xe5, 0xa2, 0xb4, 0x02, 0x53, 0x9d, 0xfa, 0x14, 0x7c, 0xa9, 0x27, 0x27, 0x78,
];

struct LinuxCryptoService {
    config: &'static KeyringConfig,
    v11_key: Option<Vec<u8>>,
}

impl LinuxCryptoService {
    fn new(config: &'static KeyringConfig) -> Self {
        Self {
            config,
            v11_key: None,
        }
    }

    fn decrypt_v10(&self, encrypted: &[u8]) -> Result<String> {
        decrypt(&V10_KEY, encrypted)
    }

    async fn decrypt_v11(&mut self, encrypted: &[u8]) -> Result<String> {
        if self.v11_key.is_none() {
            let master_password = get_master_password(self.config.application_id).await?;
            self.v11_key = Some(util::derive_saltysalt(&master_password, 1)?);
        }

        let key = self
            .v11_key
            .as_ref()
            .ok_or_else(|| anyhow!("Failed to retrieve key"))?;
        decrypt(key, encrypted)
    }
}

#[async_trait]
impl CryptoService for LinuxCryptoService {
    async fn decrypt_to_string(&mut self, encrypted: &[u8]) -> Result<String> {
        let (version, password) =
            util::split_encrypted_string_and_validate(encrypted, &["v10", "v11"])?;

        let result = match version {
            "v10" => self.decrypt_v10(password),
            "v11" => self.decrypt_v11(password).await,
            _ => Err(anyhow!("Logic error: unreachable code")),
        }?;

        Ok(result)
    }
}

fn decrypt(key: &[u8], encrypted: &[u8]) -> Result<String> {
    let plaintext = util::decrypt_aes_128_cbc(key, &IV, encrypted)?;
    String::from_utf8(plaintext).map_err(|e| anyhow!("UTF-8 error: {:?}", e))
}

async fn get_master_password(application_tag: &str) -> Result<Vec<u8>> {
    let keyring = oo7::Keyring::new().await?;
    keyring.unlock().await?;

    let attributes = HashMap::from([
        (
            XDG_SCHEMA_ATTRIBUTE,
            "chrome_libsecret_os_crypt_password_v2",
        ),
        ("application", application_tag),
    ]);

    let results = keyring.search_items(&attributes).await?;
    match results.first() {
        Some(r) => {
            let secret = r.secret().await?;
            Ok(secret.to_vec())
        }
        None => Err(anyhow!("The master password not found in the keyring")),
    }
}
