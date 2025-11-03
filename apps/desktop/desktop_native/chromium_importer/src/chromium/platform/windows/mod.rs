use aes_gcm::{aead::Aead, Aes256Gcm, Key, KeyInit, Nonce};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chacha20poly1305::ChaCha20Poly1305;
use std::path::{Path, PathBuf};
use windows::Win32::{
    Foundation::{LocalFree, HLOCAL},
    Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB},
};

use crate::chromium::{BrowserConfig, CryptoService, LocalState};
use crate::util;
mod abe;
mod abe_config;
mod signature;

pub use abe_config::ADMIN_TO_USER_PIPE_NAME;
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

// This should be enabled for production
const ENABLE_SIGNATURE_VALIDATION: bool = true;

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

        let admin_exe_path = get_admin_exe_path()?;

        if ENABLE_SIGNATURE_VALIDATION && !verify_signature(&admin_exe_path)? {
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

        let key_bytes = BASE64_STANDARD.decode(&key_base64)?;
        let key = unprotect_data_win(&key_bytes)?;

        Self::decode_abe_key_blob(key.as_slice())
    }

    fn decode_abe_key_blob(blob_data: &[u8]) -> Result<Vec<u8>> {
        let header_len = u32::from_le_bytes(blob_data[0..4].try_into()?) as usize;
        // Ignore the header

        let content_len_offset = 4 + header_len;
        let content_len =
            u32::from_le_bytes(blob_data[content_len_offset..content_len_offset + 4].try_into()?)
                as usize;

        if content_len < 1 {
            return Err(anyhow!(
                "Corrupted ABE key blob: content length is less than 1"
            ));
        }

        let content_offset = content_len_offset + 4;
        let content = &blob_data[content_offset..content_offset + content_len];

        // When the size is exactly 32 bytes, it's a plain key. It's used in unbranded Chromium builds, Brave, possibly Edge
        if content_len == 32 {
            return Ok(content.to_vec());
        }

        let version = content[0];
        let key_blob = &content[1..];
        match version {
            // Google Chrome v1 key encrypted with a hardcoded AES key
            1_u8 => Self::decrypt_abe_key_blob_chrome_aes(key_blob),
            // Google Chrome v2 key encrypted with a hardcoded ChaCha20 key
            2_u8 => Self::decrypt_abe_key_blob_chrome_chacha20(key_blob),
            // Google Chrome v3 key encrypted with CNG APIs
            3_u8 => Self::decrypt_abe_key_blob_chrome_cng(key_blob),
            v => Err(anyhow!("Unsupported ABE key blob version: {}", v)),
        }
    }

    // TODO: DRY up with decrypt_abe_key_blob_chrome_chacha20
    fn decrypt_abe_key_blob_chrome_aes(blob: &[u8]) -> Result<Vec<u8>> {
        if blob.len() < 60 {
            return Err(anyhow!(
                "Corrupted ABE key blob: expected at least 60 bytes, got {} bytes",
                blob.len()
            ));
        }

        let iv: [u8; 12] = blob[0..12].try_into()?;
        let ciphertext: [u8; 48] = blob[12..12 + 48].try_into()?;

        const GOOGLE_AES_KEY: &[u8] = &[
            0xB3, 0x1C, 0x6E, 0x24, 0x1A, 0xC8, 0x46, 0x72, 0x8D, 0xA9, 0xC1, 0xFA, 0xC4, 0x93,
            0x66, 0x51, 0xCF, 0xFB, 0x94, 0x4D, 0x14, 0x3A, 0xB8, 0x16, 0x27, 0x6B, 0xCC, 0x6D,
            0xA0, 0x28, 0x47, 0x87,
        ];
        let aes_key = Key::<Aes256Gcm>::from_slice(GOOGLE_AES_KEY);
        let cipher = Aes256Gcm::new(aes_key);

        let decrypted = cipher
            .decrypt((&iv).into(), ciphertext.as_ref())
            .map_err(|e| anyhow!("Failed to decrypt v20 key with Google AES key: {}", e))?;

        Ok(decrypted)
    }

    fn decrypt_abe_key_blob_chrome_chacha20(blob: &[u8]) -> Result<Vec<u8>> {
        if blob.len() < 60 {
            return Err(anyhow!(
                "Corrupted ABE key blob: expected at least 60 bytes, got {} bytes",
                blob.len()
            ));
        }

        let chacha20_key = chacha20poly1305::Key::from_slice(GOOGLE_CHACHA20_KEY);
        let cipher = ChaCha20Poly1305::new(chacha20_key);

        const GOOGLE_CHACHA20_KEY: &[u8] = &[
            0xE9, 0x8F, 0x37, 0xD7, 0xF4, 0xE1, 0xFA, 0x43, 0x3D, 0x19, 0x30, 0x4D, 0xC2, 0x25,
            0x80, 0x42, 0x09, 0x0E, 0x2D, 0x1D, 0x7E, 0xEA, 0x76, 0x70, 0xD4, 0x1F, 0x73, 0x8D,
            0x08, 0x72, 0x96, 0x60,
        ];

        let iv: [u8; 12] = blob[0..12].try_into()?;
        let ciphertext: [u8; 48] = blob[12..12 + 48].try_into()?;

        let decrypted = cipher
            .decrypt((&iv).into(), ciphertext.as_ref())
            .map_err(|e| anyhow!("Failed to decrypt v20 key with Google ChaCha20 key: {}", e))?;

        Ok(decrypted)
    }

    fn decrypt_abe_key_blob_chrome_cng(blob: &[u8]) -> Result<Vec<u8>> {
        if blob.len() < 92 {
            return Err(anyhow!(
                "Corrupted ABE key blob: expected at least 92 bytes, got {} bytes",
                blob.len()
            ));
        }

        let _encrypted_aes_key: [u8; 32] = blob[0..32].try_into()?;
        let _iv: [u8; 12] = blob[32..32 + 12].try_into()?;
        let _ciphertext: [u8; 48] = blob[44..44 + 48].try_into()?;

        // TODO: Decrypt the AES key using CNG APIs
        // TODO: Implement this in the future once we run into a browser that uses this scheme

        // There's no way to test this at the moment. This encryption scheme is not used in any of the browsers I've tested.
        Err(anyhow!("Google ABE CNG flavor is not supported yet"))
    }
}

fn unprotect_data_win(data: &[u8]) -> Result<Vec<u8>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let data_in = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };

    let mut data_out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let result = unsafe {
        CryptUnprotectData(
            &data_in,
            None, // ppszDataDescr: Option<*mut PWSTR>
            None, // pOptionalEntropy: Option<*const CRYPT_INTEGER_BLOB>
            None, // pvReserved: Option<*const std::ffi::c_void>
            None, // pPromptStruct: Option<*const CRYPTPROTECT_PROMPTSTRUCT>
            0,    // dwFlags: u32
            &mut data_out,
        )
    };

    if result.is_err() {
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
