use std::sync::Mutex;

use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chacha20poly1305::ChaCha20Poly1305;
use winapi::shared::minwindef::{BOOL, BYTE, DWORD};
use winapi::um::{dpapi::CryptUnprotectData, wincrypt::DATA_BLOB};
use windows::Win32::Foundation::{LocalFree, HLOCAL};

use crate::chromium::{BrowserConfig, CryptoService, LocalState};

mod abe;

#[allow(dead_code)]
mod util;

//
// Public API
//

pub const SUPPORTED_BROWSERS: [BrowserConfig; 6] = [
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
        name: "Brave",
        data_dir: "AppData/Local/BraveSoftware/Brave-Browser/User Data",
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

pub fn get_crypto_service(
    _browser_name: &str,
    local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    Ok(Box::new(WindowsCryptoService::new(local_state)))
}

pub fn configure_windows_crypto_service(admin_exe_path: &String) {
    *ADMIN_EXE_PATH.lock().unwrap() = Some(admin_exe_path.clone());
}

//
// Private
//

static ADMIN_EXE_PATH: Mutex<Option<String>> = Mutex::new(None);

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

        let key = unprotect_data_win(&key_bytes[5..])
            .map_err(|e| anyhow!("Failed to unprotect the master key: {}", e))?;

        Ok(key)
    }

    async fn get_master_key_v20(&mut self) -> Result<Vec<u8>> {
        if self.app_bound_encrypted_key.is_none() {
            return Err(anyhow!(
                "Encrypted master key is not found in the local browser state"
            ));
        }

        let key_base64 = abe::decrypt_with_admin(
            &get_admin_exe_path()?,
            &self.app_bound_encrypted_key.as_ref().unwrap(),
        )
        .await?;

        if key_base64.starts_with('!') {
            return Err(anyhow!(
                "Failed to decrypt the master key: {}",
                &key_base64[1..]
            ));
        }

        let key_bytes = BASE64_STANDARD.decode(&key_base64)?;
        let key = unprotect_data_win(&key_bytes)?;

        if key.len() < 61 {
            return Err(anyhow!("Decrypted v20 key is too short"));
        }

        let key = key[key.len() - 61..].to_vec();

        let version = key[0];
        let iv = &key[1..13];
        let ciphertext = &key[13..key.len() - 16];
        let tag = &key[key.len() - 16..];

        match version {
            0x01 => {
                // Google's fixed AES key for v20 decryption
                const GOOGLE_AES_KEY: &[u8] = &[
                    0xB3, 0x1C, 0x6E, 0x24, 0x1A, 0xC8, 0x46, 0x72, 0x8D, 0xA9, 0xC1, 0xFA, 0xC4,
                    0x93, 0x66, 0x51, 0xCF, 0xFB, 0x94, 0x4D, 0x14, 0x3A, 0xB8, 0x16, 0x27, 0x6B,
                    0xCC, 0x6D, 0xA0, 0x28, 0x47, 0x87,
                ];

                let aes_key = Key::<Aes256Gcm>::from_slice(GOOGLE_AES_KEY);
                let cipher = Aes256Gcm::new(aes_key);
                let nonce = Nonce::from_slice(iv);

                let mut ciphertext_with_tag = Vec::new();
                ciphertext_with_tag.extend_from_slice(ciphertext);
                ciphertext_with_tag.extend_from_slice(tag);

                let decrypted = cipher
                    .decrypt(nonce, ciphertext_with_tag.as_ref())
                    .map_err(|e| anyhow!("Failed to decrypt v20 key with Google AES key: {}", e))?;

                return Ok(decrypted);
            }

            0x02 => {
                // Google's fixed ChaCha20 key for v20 decryption
                const GOOGLE_CHACHA20_KEY: &[u8] = &[
                    0xE9, 0x8F, 0x37, 0xD7, 0xF4, 0xE1, 0xFA, 0x43, 0x3D, 0x19, 0x30, 0x4D, 0xC2,
                    0x25, 0x80, 0x42, 0x09, 0x0E, 0x2D, 0x1D, 0x7E, 0xEA, 0x76, 0x70, 0xD4, 0x1F,
                    0x73, 0x8D, 0x08, 0x72, 0x96, 0x60,
                ];

                let chacha20_key = chacha20poly1305::Key::from_slice(GOOGLE_CHACHA20_KEY);
                let cipher = ChaCha20Poly1305::new(chacha20_key);
                let nonce = chacha20poly1305::Nonce::from_slice(iv);

                let mut ciphertext_with_tag = Vec::new();
                ciphertext_with_tag.extend_from_slice(ciphertext);
                ciphertext_with_tag.extend_from_slice(tag);

                let decrypted = cipher
                    .decrypt(nonce, ciphertext_with_tag.as_ref())
                    .map_err(|e| {
                        anyhow!("Failed to decrypt v20 key with Google ChaCha20 key: {}", e)
                    })?;

                return Ok(decrypted);
            }

            _ => {
                return Err(anyhow!("Unsupported v20 key version: {}", version));
            }
        }
    }
}

fn unprotect_data_win(data: &[u8]) -> Result<Vec<u8>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let mut data_in = DATA_BLOB {
        cbData: data.len() as DWORD,
        pbData: data.as_ptr() as *mut BYTE,
    };

    let mut data_out = DATA_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let result: BOOL = unsafe {
        // BOOL from winapi (i32)
        CryptUnprotectData(
            &mut data_in,
            std::ptr::null_mut(), // ppszDataDescr: *mut LPWSTR (*mut *mut u16)
            std::ptr::null_mut(), // pOptionalEntropy: *mut DATA_BLOB
            std::ptr::null_mut(), // pvReserved: LPVOID (*mut c_void)
            std::ptr::null_mut(), // pPromptStruct: *mut CRYPTPROTECT_PROMPTSTRUCT
            0,                    // dwFlags: DWORD
            &mut data_out,
        )
    };

    if result == 0 {
        return Err(anyhow!("CryptUnprotectData failed"));
    }

    if data_out.pbData.is_null() || data_out.cbData == 0 {
        return Ok(Vec::new());
    }

    let output_slice =
        unsafe { std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize) };

    unsafe {
        if !data_out.pbData.is_null() {
            LocalFree(Some(HLOCAL(data_out.pbData as *mut std::ffi::c_void)));
        }
    }

    Ok(output_slice.to_vec())
}

fn get_admin_exe_path() -> Result<String> {
    ADMIN_EXE_PATH
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| anyhow!("admin.exe path is not set"))
}
