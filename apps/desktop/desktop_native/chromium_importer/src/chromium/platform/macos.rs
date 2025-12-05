use anyhow::{anyhow, Result};
use async_trait::async_trait;
use security_framework::passwords::get_generic_password;

use crate::{
    chromium::{BrowserConfig, CryptoService, LocalState},
    util,
};

//
// Sandbox specific (for Mac App Store Builds)
//

pub mod sandbox {
    use anyhow::{anyhow, Result};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Deserialize)]
    #[serde(tag = "type")]
    enum CommandResult<T> {
        #[serde(rename = "success")]
        Success { value: T },
        #[serde(rename = "error")]
        Error { error: String },
    }

    #[derive(Debug, Deserialize)]
    struct RequestAccessResponse {
        #[allow(dead_code)]
        bookmark: String,
    }

    #[derive(Debug, Deserialize)]
    struct HasStoredAccessResponse {
        #[serde(rename = "hasAccess")]
        has_access: bool,
    }

    #[derive(Debug, Deserialize)]
    struct StartAccessResponse {
        #[allow(dead_code)]
        path: String,
    }

    #[derive(Debug, Serialize)]
    struct CommandInput {
        namespace: String,
        command: String,
        params: serde_json::Value,
    }

    pub struct ScopedBrowserAccess {
        browser_name: String,
    }

    impl ScopedBrowserAccess {
        /// Request access to browser directory and create a security bookmark if access is approved
        pub async fn request_only(browser_name: &str) -> Result<()> {
            let config = crate::chromium::platform::SUPPORTED_BROWSERS
                .iter()
                .find(|b| b.name == browser_name)
                .ok_or_else(|| anyhow!("Unsupported browser: {}", browser_name))?;

            // For macOS, data_dir is always a single-element array
            let relative_path = config
                .data_dir
                .first()
                .ok_or_else(|| anyhow!("No data directory configured for browser"))?;

            let input = CommandInput {
                namespace: "chromium_importer".to_string(),
                command: "request_access".to_string(),
                params: serde_json::json!({
                    "browserName": browser_name,
                    "relativePath": relative_path,
                }),
            };

            let output = desktop_objc::run_command(serde_json::to_string(&input)?)
                .await
                .map_err(|e| anyhow!("Failed to call ObjC command: {}", e))?;

            let result: CommandResult<RequestAccessResponse> = serde_json::from_str(&output)
                .map_err(|e| anyhow!("Failed to parse ObjC response: {}", e))?;

            match result {
                CommandResult::Success { .. } => Ok(()),
                CommandResult::Error { error } => Err(anyhow!("{}", error)),
            }
        }

        /// Resume browser directory access using previously created security bookmark
        pub async fn resume(browser_name: &str) -> Result<Self> {
            // First check if we have stored access
            let has_access_input = CommandInput {
                namespace: "chromium_importer".to_string(),
                command: "has_stored_access".to_string(),
                params: serde_json::json!({
                    "browserName": browser_name,
                }),
            };

            let has_access_output =
                desktop_objc::run_command(serde_json::to_string(&has_access_input)?)
                    .await
                    .map_err(|e| anyhow!("Failed to call ObjC command: {}", e))?;

            let has_access_result: CommandResult<HasStoredAccessResponse> =
                serde_json::from_str(&has_access_output)
                    .map_err(|e| anyhow!("Failed to parse ObjC response: {}", e))?;

            let has_access = match has_access_result {
                CommandResult::Success { value } => value.has_access,
                CommandResult::Error { error } => return Err(anyhow!("{}", error)),
            };

            if !has_access {
                return Err(anyhow!("Access has not been granted for this browser"));
            }

            // Start accessing the browser
            let start_input = CommandInput {
                namespace: "chromium_importer".to_string(),
                command: "start_access".to_string(),
                params: serde_json::json!({
                    "browserName": browser_name,
                }),
            };

            let start_output = desktop_objc::run_command(serde_json::to_string(&start_input)?)
                .await
                .map_err(|e| anyhow!("Failed to call ObjC command: {}", e))?;

            let start_result: CommandResult<StartAccessResponse> =
                serde_json::from_str(&start_output)
                    .map_err(|e| anyhow!("Failed to parse ObjC response: {}", e))?;

            match start_result {
                CommandResult::Success { .. } => Ok(Self {
                    browser_name: browser_name.to_string(),
                }),
                CommandResult::Error { error } => Err(anyhow!("{}", error)),
            }
        }
    }

    impl Drop for ScopedBrowserAccess {
        fn drop(&mut self) {
            let browser_name = self.browser_name.clone();

            tokio::task::spawn(async move {
                let input = CommandInput {
                    namespace: "chromium_importer".to_string(),
                    command: "stop_access".to_string(),
                    params: serde_json::json!({
                        "browserName": browser_name,
                    }),
                };

                if let Ok(input_json) = serde_json::to_string(&input) {
                    let _ = desktop_objc::run_command(input_json).await;
                }
            });
        }
    }
}

//
// Public API
//

pub(crate) const SUPPORTED_BROWSERS: &[BrowserConfig] = &[
    BrowserConfig {
        name: "Chrome",
        data_dir: &["Library/Application Support/Google/Chrome"],
    },
    BrowserConfig {
        name: "Chromium",
        data_dir: &["Library/Application Support/Chromium"],
    },
    BrowserConfig {
        name: "Microsoft Edge",
        data_dir: &["Library/Application Support/Microsoft Edge"],
    },
    BrowserConfig {
        name: "Brave",
        data_dir: &["Library/Application Support/BraveSoftware/Brave-Browser"],
    },
    BrowserConfig {
        name: "Arc",
        data_dir: &["Library/Application Support/Arc/User Data"],
    },
    BrowserConfig {
        name: "Opera",
        data_dir: &["Library/Application Support/com.operasoftware.Opera"],
    },
    BrowserConfig {
        name: "Vivaldi",
        data_dir: &["Library/Application Support/Vivaldi"],
    },
];

pub(crate) fn get_crypto_service(
    browser_name: &str,
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
