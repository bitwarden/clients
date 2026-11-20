use std::{
    future::Future,
    path::{Path, PathBuf},
};

use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use tokio::sync::OnceCell;

use crate::{
    chromium::{BrowserConfig, CryptoService, LocalState, WrongKeyError},
    util,
};
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
        data_dir: &["AppData/Local/BraveSoftware/Brave-Browser/User Data"],
        bundle_id: None,
    },
    BrowserConfig {
        name: "Chrome",
        data_dir: &["AppData/Local/Google/Chrome/User Data"],
        bundle_id: None,
    },
    BrowserConfig {
        name: "Chromium",
        data_dir: &["AppData/Local/Chromium/User Data"],
        bundle_id: None,
    },
    BrowserConfig {
        name: "Microsoft Edge",
        data_dir: &["AppData/Local/Microsoft/Edge/User Data"],
        bundle_id: None,
    },
    BrowserConfig {
        name: "Opera",
        data_dir: &["AppData/Roaming/Opera Software/Opera Stable"],
        bundle_id: None,
    },
    BrowserConfig {
        name: "Vivaldi",
        data_dir: &["AppData/Local/Vivaldi/User Data"],
        bundle_id: None,
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
    master_keys: MasterKeyCache,
    encrypted_key: Option<String>,
    app_bound_encrypted_key: Option<String>,
}

#[derive(Default)]
struct MasterKeyCache {
    v10: OnceCell<Result<Vec<u8>, String>>,
    v20: OnceCell<Result<Vec<u8>, String>>,
}

impl MasterKeyCache {
    async fn get_or_fetch(
        &self,
        version: &str,
        fetch: impl Future<Output = Result<Vec<u8>>>,
    ) -> Result<&[u8]> {
        let cached = match version {
            "v10" => &self.v10,
            "v20" => &self.v20,
            _ => return Err(anyhow!("Unsupported version: {}", version)),
        };

        cached
            .get_or_init(|| async { fetch.await.map_err(|e| e.to_string()) })
            .await
            .as_deref()
            .map_err(|e| anyhow!(e.clone()))
    }
}

impl WindowsCryptoService {
    pub(crate) fn new(local_state: &LocalState) -> Self {
        Self {
            master_keys: MasterKeyCache::default(),
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

        // v10 is already stripped; Windows Chrome uses AES-GCM: [12 bytes IV][ciphertext][16 bytes
        // auth tag]
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

        let key = self.get_master_key(version).await?;
        let cipher = Aes256Gcm::new_from_slice(key)?;
        let nonce = Nonce::try_from(&no_prefix[..IV_SIZE])?;

        let decrypted_bytes = cipher
            .decrypt(&nonce, no_prefix[IV_SIZE..].as_ref())
            .map_err(|e| WrongKeyError(e.to_string()))?;

        let plaintext = String::from_utf8(decrypted_bytes)
            .map_err(|e| anyhow!("Failed to convert decrypted data to UTF-8: {}", e))?;

        Ok(plaintext)
    }
}

impl WindowsCryptoService {
    async fn get_master_key(&self, version: &str) -> Result<&[u8]> {
        self.master_keys
            .get_or_fetch(version, async {
                match version {
                    "v10" => self.get_master_key_v10(),
                    "v20" => self.get_master_key_v20().await,
                    _ => Err(anyhow!("Unsupported version: {}", version)),
                }
            })
            .await
    }

    fn get_master_key_v10(&self) -> Result<Vec<u8>> {
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

    async fn get_master_key_v20(&self) -> Result<Vec<u8>> {
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

// Try to find bitwarden_chromium_import_helper.exe in debug build folders. This might not cover all
// the cases. Tested on `npm run electron` from apps/desktop and apps/desktop/desktop_native.
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

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::*;

    #[tokio::test]
    async fn fetches_each_version_once() -> Result<()> {
        let cache = MasterKeyCache::default();
        let fetches = Cell::new(0);

        for (version, expected_key) in [
            ("v20", [0x20; 32]),
            ("v10", [0x10; 32]),
            ("v20", [0x20; 32]),
            ("v10", [0x10; 32]),
        ] {
            let key = cache
                .get_or_fetch(version, async {
                    fetches.set(fetches.get() + 1);
                    Ok(expected_key.to_vec())
                })
                .await?;
            assert_eq!(key, expected_key);
        }

        assert_eq!(fetches.get(), 2);
        Ok(())
    }

    #[tokio::test]
    async fn caches_first_error_without_affecting_other_version() -> Result<()> {
        for (failed_version, working_version) in [("v20", "v10"), ("v10", "v20")] {
            let cache = MasterKeyCache::default();
            let fetches = Cell::new(0);
            let first_error =
                "Failed to decrypt the master key: Unsupported ABE key blob version: 4";

            for attempt in 0..6 {
                let error = cache
                    .get_or_fetch(failed_version, async {
                        fetches.set(fetches.get() + 1);
                        if attempt == 0 {
                            Err(anyhow!(first_error))
                        } else {
                            Err(anyhow!("Key fetch should not be retried"))
                        }
                    })
                    .await
                    .unwrap_err();
                assert_eq!(error.to_string(), first_error);
            }

            assert_eq!(fetches.get(), 1);
            assert_eq!(
                cache
                    .get_or_fetch(working_version, async { Ok(vec![0x11; 32]) })
                    .await?,
                &[0x11; 32]
            );
        }
        Ok(())
    }

    #[tokio::test]
    async fn decrypts_passwords_and_notes_with_different_versions() -> Result<()> {
        let local_state: LocalState = serde_json::from_str(r#"{"profile":{"info_cache":{}}}"#)?;
        let mut service = WindowsCryptoService::new(&local_state);

        for (version, key) in [("v10", [0x10; 32]), ("v20", [0x20; 32])] {
            service
                .master_keys
                .get_or_fetch(version, async { Ok(key.to_vec()) })
                .await?;
        }

        for (version, key, plaintext) in [
            ("v20", [0x20; 32], "synthetic password"),
            ("v10", [0x10; 32], "synthetic note"),
            ("v20", [0x20; 32], "another synthetic password"),
        ] {
            let nonce = Nonce::from([0x33; 12]);
            let ciphertext = Aes256Gcm::new_from_slice(&key)?
                .encrypt(&nonce, plaintext.as_bytes())
                .map_err(|e| anyhow!("Failed to encrypt test fixture: {}", e))?;
            let mut encrypted = version.as_bytes().to_vec();
            encrypted.extend_from_slice(&nonce);
            encrypted.extend_from_slice(&ciphertext);

            assert_eq!(service.decrypt_to_string(&encrypted).await?, plaintext);
        }
        Ok(())
    }
}
