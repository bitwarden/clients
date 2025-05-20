use anyhow::{Result, anyhow};
use std::path::PathBuf;

use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};

use winapi::shared::minwindef::{BOOL, BYTE, DWORD};
use winapi::um::{dpapi::CryptUnprotectData, wincrypt::DATA_BLOB};
use windows::Win32::Foundation::{HLOCAL, LocalFree};

use crate::chromium::{CryptoService, LocalState};

//
// Public API
//

pub fn get_supported_browsers() -> Vec<String> {
    SUPPORTED_BROWSERS
        .iter()
        .map(|b| b.name.to_string())
        .collect()
}

pub fn get_browser_settings_directory(browser_name: &str) -> Result<PathBuf> {
    let config = find_browser_config(browser_name)
        .ok_or_else(|| anyhow!("Unsupported browser: {}", browser_name))?;

    let home_dir = home::home_dir().ok_or_else(|| anyhow!("Could not determine home directory"))?;

    let path = home_dir
        .join("AppData")
        .join("Local")
        .join(config.company)
        .join(config.product)
        .join("User Data");

    Ok(path)
}

pub fn get_crypto_service(
    _browser_name: &str,
    local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    Ok(Box::new(WindowsCryptoService::new(local_state)))
}

//
// Private
//

#[derive(Debug)]
struct BrowserConfig {
    name: &'static str,
    company: &'static str,
    product: &'static str,
}

const SUPPORTED_BROWSERS: &[BrowserConfig] = &[
    BrowserConfig {
        name: "Chrome",
        company: "Google",
        product: "Chrome",
    },
    BrowserConfig {
        name: "Edge",
        company: "Microsoft",
        product: "Edge",
    },
    BrowserConfig {
        name: "Brave",
        company: "BraveSoftware",
        product: "Brave-Browser",
    },
];

fn find_browser_config(browser_name: &str) -> Option<&'static BrowserConfig> {
    SUPPORTED_BROWSERS.iter().find(|b| b.name == browser_name)
}

//
// CryptoService
//
struct WindowsCryptoService {
    master_key: Option<Vec<u8>>,
    encrypted_key: Option<String>,
}

impl WindowsCryptoService {
    pub(crate) fn new(local_state: &LocalState) -> Self {
        Self {
            master_key: None,
            encrypted_key: local_state
                .os_crypt
                .as_ref()
                .and_then(|c| c.encrypted_key.clone()),
        }
    }
}

fn split_prefix(data: &[u8]) -> Result<(&[u8], &[u8])> {
    if data.len() < 3 {
        return Err(anyhow!(
            "Data too short to contain a 3-byte prefix: {} bytes",
            data.len()
        ));
    }
    Ok((&data[..3], &data[3..]))
}

pub fn split_and_validate_version<'a>(
    data: &'a [u8],
    allowed_versions: &[&str],
) -> Result<(&'a [u8], &'a [u8])> {
    let (prefix, rest) = split_prefix(data)?;

    // Convert prefix to &str for comparison
    let prefix_str =
        std::str::from_utf8(prefix).map_err(|e| anyhow!("Prefix is not valid UTF-8: {}", e))?;

    // Check against the allowed list
    if allowed_versions.iter().any(|&p| p == prefix_str) {
        Ok((prefix, rest))
    } else {
        Err(anyhow!("Unsupported encryption version: {}", prefix_str))
    }
}

impl CryptoService for WindowsCryptoService {
    fn decrypt_to_string(&mut self, encrypted: &[u8]) -> Result<String> {
        if encrypted.is_empty() {
            return Ok(String::new());
        }

        // On Windows only v10 is supported at the moment
        let (_, no_prefix) = split_and_validate_version(encrypted, &["v10"])?;

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
            self.master_key = Some(self.get_master_key()?);
        }

        let key = Key::<Aes256Gcm>::from_slice(self.master_key.as_ref().unwrap());
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
    fn get_master_key(&mut self) -> Result<Vec<u8>> {
        if self.encrypted_key.is_none() {
            return Err(anyhow!(
                "Encrypted master key is not found in the local browser state"
            ));
        }

        let key_bytes = BASE64_STANDARD
            .decode(self.encrypted_key.as_ref().unwrap())
            .map_err(|e| anyhow!("Encrypted master key is not a valid base64 string: {}", e))?;

        if key_bytes.len() <= 5 || &key_bytes[..5] != b"DPAPI" {
            return Err(anyhow!("Encrypted master key is not encrypted with DPAPI"));
        }

        let key = unprotect_data_win(&key_bytes[5..])
            .map_err(|e| anyhow!("Failed to unprotect the master key: {}", e))?;

        Ok(key)
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
            LocalFree(HLOCAL(data_out.pbData as *mut std::ffi::c_void));
        }
    }

    Ok(output_slice.to_vec())
}
