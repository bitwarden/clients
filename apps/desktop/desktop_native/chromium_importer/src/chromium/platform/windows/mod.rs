use aes_gcm::{aead::Aead, Aes256Gcm, Key, KeyInit, Nonce};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use std::path::{Path, PathBuf};

use crate::chromium::{BrowserConfig, CryptoService, LocalState};
use crate::util;
mod abe;
mod abe_config;
mod crypto;
mod signature;

pub use abe_config::ADMIN_TO_USER_PIPE_NAME;
pub use crypto::*;
pub use signature::*;

//
// Public API
//

pub(crate) const SUPPORTED_BROWSERS: &[BrowserConfig] = &[
    BrowserConfig {
        name: "Brave",
        data_dir: "AppData/Local/BraveSoftware/Brave-Browser/User Data",
    },
    BrowserConfig {
        name: "Chrome",
        data_dir: "AppData/Local/Google/Chrome/User Data",
    },
    BrowserConfig {
        name: "Chromium",
        data_dir: "AppData/Local/Chromium/User Data",
    },
    BrowserConfig {
        name: "Microsoft Edge",
        data_dir: "AppData/Local/Microsoft/Edge/User Data",
    },
    BrowserConfig {
        name: "Opera",
        data_dir: "AppData/Roaming/Opera Software/Opera Stable",
    },
    BrowserConfig {
        name: "Vivaldi",
        data_dir: "AppData/Local/Vivaldi/User Data",
    },
];

pub(crate) fn get_crypto_service(
    _browser_name: &str,
    local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    Ok(Box::new(WindowsCryptoService::new(local_state)))
}

//
// Private
//

const ADMIN_EXE_FILENAME: &str = "bitwarden_chromium_import_helper.exe";

//
// CryptoService
//
struct WindowsCryptoService {
    master_key: Option<Vec<u8>>,
    encrypted_key: Option<String>,
    app_bound_encrypted_key: Option<String>,
}

impl WindowsCryptoService {
    pub(crate) fn new(local_state: &LocalState) -> Self {
        Self {
            master_key: None,
            encrypted_key: local_state
                .os_crypt
                .as_ref()
                .and_then(|c| c.encrypted_key.clone()),
            app_bound_encrypted_key: local_state
                .os_crypt
                .as_ref()
                .and_then(|c| c.app_bound_encrypted_key.clone()),
        }
    }
}

#[async_trait]
impl CryptoService for WindowsCryptoService {
    async fn decrypt_to_string(&mut self, encrypted: &[u8]) -> Result<String> {
        if encrypted.is_empty() {
            return Ok(String::new());
        }

        // On Windows only v10 and v20 are supported at the moment
        let (version, no_prefix) =
            util::split_encrypted_string_and_validate(encrypted, &["v10", "v20"])?;

        // v10 is already stripped; Windows Chrome uses AES-GCM: [12 bytes IV][ciphertext][16 bytes auth tag]
        const IV_SIZE: usize = 12;
        const TAG_SIZE: usize = 16;
        const MIN_LENGTH: usize = IV_SIZE + TAG_SIZE;

        if no_prefix.len() < MIN_LENGTH {
            return Err(anyhow!(
                "Corrupted entry: expected at least {} bytes, got {} bytes",
                MIN_LENGTH,
                no_prefix.len()
            ));
        }

        // Allow empty passwords
        if no_prefix.len() == MIN_LENGTH {
            return Ok(String::new());
        }

        if self.master_key.is_none() {
            self.master_key = Some(self.get_master_key(version).await?);
        }

        let key = self
            .master_key
            .as_ref()
            .ok_or_else(|| anyhow!("Failed to retrieve key"))?;
        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(&no_prefix[..IV_SIZE]);

        let decrypted_bytes = cipher
            .decrypt(nonce, no_prefix[IV_SIZE..].as_ref())
            .map_err(|e| anyhow!("Decryption failed: {}", e))?;

        let plaintext = String::from_utf8(decrypted_bytes)
            .map_err(|e| anyhow!("Failed to convert decrypted data to UTF-8: {}", e))?;

        Ok(plaintext)
    }
}

impl WindowsCryptoService {
    async fn get_master_key(&mut self, version: &str) -> Result<Vec<u8>> {
        match version {
            "v10" => self.get_master_key_v10(),
            "v20" => self.get_master_key_v20().await,
            _ => Err(anyhow!("Unsupported version: {}", version)),
        }
    }

    fn get_master_key_v10(&mut self) -> Result<Vec<u8>> {
        if self.encrypted_key.is_none() {
            return Err(anyhow!(
                "Encrypted master key is not found in the local browser state"
            ));
        }

        let key = self
            .encrypted_key
            .as_ref()
            .ok_or_else(|| anyhow!("Failed to retrieve key"))?;
        let key_bytes = BASE64_STANDARD
            .decode(key)
            .map_err(|e| anyhow!("Encrypted master key is not a valid base64 string: {}", e))?;

        if key_bytes.len() <= 5 || &key_bytes[..5] != b"DPAPI" {
            return Err(anyhow!("Encrypted master key is not encrypted with DPAPI"));
        }

        let key = crypt_unprotect_data(&key_bytes[5..], 0)
            .map_err(|e| anyhow!("Failed to unprotect the master key: {}", e))?;

        Ok(key)
    }

    async fn get_master_key_v20(&mut self) -> Result<Vec<u8>> {
        if self.app_bound_encrypted_key.is_none() {
            return Err(anyhow!(
                "Encrypted master key is not found in the local browser state"
            ));
        }

        let admin_exe_path = get_admin_exe_path()?;

        if !verify_signature(&admin_exe_path)? {
            return Err(anyhow!("Helper executable signature is not valid"));
        }

        let admin_exe_str = admin_exe_path
            .to_str()
            .ok_or_else(|| anyhow!("Failed to convert {} path to string", ADMIN_EXE_FILENAME))?;

        let key_base64 = abe::decrypt_with_admin_exe(
            admin_exe_str,
            self.app_bound_encrypted_key
                .as_ref()
                .expect("app_bound_encrypted_key should not be None"),
        )
        .await?;

        if let Some(error_message) = key_base64.strip_prefix('!') {
            return Err(anyhow!(
                "Failed to decrypt the master key: {}",
                error_message
            ));
        }

        let key = BASE64_STANDARD.decode(&key_base64)?;
        Ok(key)
    }
}

fn get_admin_exe_path() -> Result<PathBuf> {
    let current_exe_full_path = std::env::current_exe()
        .map_err(|e| anyhow!("Failed to get current executable path: {}", e))?;

    let exe_name = current_exe_full_path
        .file_name()
        .ok_or_else(|| anyhow!("Failed to get file name from current executable path"))?;

    let admin_exe_full_path = if exe_name.eq_ignore_ascii_case("electron.exe") {
        get_debug_admin_exe_path()?
    } else {
        get_dist_admin_exe_path(&current_exe_full_path)?
    };

    // check if bitwarden_chromium_import_helper.exe exists
    if !admin_exe_full_path.exists() {
        return Err(anyhow!(
            "{} not found at path: {:?}",
            ADMIN_EXE_FILENAME,
            admin_exe_full_path
        ));
    }

    Ok(admin_exe_full_path)
}

fn get_dist_admin_exe_path(current_exe_full_path: &Path) -> Result<PathBuf> {
    let admin_exe = current_exe_full_path
        .parent()
        .map(|p| p.join(ADMIN_EXE_FILENAME))
        .ok_or_else(|| anyhow!("Failed to get parent directory of current executable"))?;

    Ok(admin_exe)
}

// Try to find bitwarden_chromium_import_helper.exe in debug build folders. This might not cover all the cases.
// Tested on `npm run electron` from apps/desktop and apps/desktop/desktop_native.
fn get_debug_admin_exe_path() -> Result<PathBuf> {
    let current_dir = std::env::current_dir()?;
    let folder_name = current_dir
        .file_name()
        .ok_or_else(|| anyhow!("Failed to get folder name from current directory"))?;
    match folder_name.to_str() {
        Some("desktop") => Ok(get_target_admin_exe_path(
            current_dir.join("desktop_native"),
        )),
        Some("desktop_native") => Ok(get_target_admin_exe_path(current_dir)),
        _ => Err(anyhow!(
            "Cannot determine {} path from current directory: {}",
            ADMIN_EXE_FILENAME,
            current_dir.display()
        )),
    }
}

fn get_target_admin_exe_path(desktop_native_dir: PathBuf) -> PathBuf {
    desktop_native_dir
        .join("target")
        .join("debug")
        .join(ADMIN_EXE_FILENAME)
}
