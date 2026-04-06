use aes_gcm::{aead::Aead, Aes256Gcm, Key, KeyInit};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use chacha20poly1305::ChaCha20Poly1305;
use chromium_importer::chromium::crypt_unprotect_data;
use scopeguard::defer;
use tracing::debug;
use windows::{
    core::w,
    Win32::Security::Cryptography::{
        self, NCryptOpenKey, NCryptOpenStorageProvider, CERT_KEY_SPEC, CRYPTPROTECT_UI_FORBIDDEN,
        NCRYPT_FLAGS, NCRYPT_KEY_HANDLE, NCRYPT_PROV_HANDLE, NCRYPT_SILENT_FLAG,
    },
};

use super::impersonate::{start_impersonating, stop_impersonating};

//
// Base64
//

pub(crate) fn decode_base64(data_base64: &str) -> Result<Vec<u8>> {
    debug!("Decoding base64 data: {}", data_base64);

    let data = general_purpose::STANDARD.decode(data_base64).map_err(|e| {
        debug!("Failed to decode base64: {}", e);
        e
    })?;

    Ok(data)
}

pub(crate) fn encode_base64(data: &[u8]) -> String {
    general_purpose::STANDARD.encode(data)
}

//
// DPAPI decryption
//

pub(crate) fn decrypt_with_dpapi_as_system(encrypted: &[u8]) -> Result<Vec<u8>> {
    // Impersonate a SYSTEM process to be able to decrypt data encrypted for the machine
    let system_token = start_impersonating()?;
    defer! {
        debug!("Stopping impersonation");
        _ = stop_impersonating(system_token);
    }

    decrypt_with_dpapi_as_user(encrypted, true)
}

pub(crate) fn decrypt_with_dpapi_as_user(encrypted: &[u8], expect_appb: bool) -> Result<Vec<u8>> {
    let system_decrypted = decrypt_with_dpapi(encrypted, expect_appb)?;
    debug!(
        "Decrypted data with SYSTEM {} bytes",
        system_decrypted.len()
    );

    Ok(system_decrypted)
}

fn decrypt_with_dpapi(data: &[u8], expect_appb: bool) -> Result<Vec<u8>> {
    if expect_appb && (data.len() < 5 || !data.starts_with(b"APPB")) {
        const ERR_MSG: &str = "Ciphertext is too short or does not start with 'APPB'";
        debug!("{}", ERR_MSG);
        return Err(anyhow!(ERR_MSG));
    }

    let data = if expect_appb { &data[4..] } else { data };

    crypt_unprotect_data(data, CRYPTPROTECT_UI_FORBIDDEN)
}

//
// Chromium key decoding
//

pub(crate) fn decode_abe_key_blob(blob_data: &[u8]) -> Result<Vec<u8>> {
    // Parse and skip the header
    let header_len = u32::from_le_bytes(get_safe(blob_data, 0, 4)?.try_into()?) as usize;
    debug!("ABE key blob header length: {}", header_len);

    // Parse content length
    let content_len_offset = 4 + header_len;
    let content_len =
        u32::from_le_bytes(get_safe(blob_data, content_len_offset, 4)?.try_into()?) as usize;
    debug!("ABE key blob content length: {}", content_len);

    if content_len < 32 {
        return Err(anyhow!(
            "Corrupted ABE key blob: content length is less than 32"
        ));
    }

    let content_offset = content_len_offset + 4;
    let content = get_safe(blob_data, content_offset, content_len)?;

    // When the size is exactly 32 bytes, it's a plain key. It's used in unbranded Chromium builds,
    // Brave, possibly Edge
    if content_len == 32 {
        return Ok(content.to_vec());
    }

    let version = content[0];
    debug!("ABE key blob version: {}", version);

    let key_blob = &content[1..];
    match version {
        // Google Chrome v1 key encrypted with a hardcoded AES key
        1_u8 => decrypt_abe_key_blob_chrome_aes(key_blob),
        // Google Chrome v2 key encrypted with a hardcoded ChaCha20 key
        2_u8 => decrypt_abe_key_blob_chrome_chacha20(key_blob),
        // Google Chrome v3 key encrypted with CNG APIs
        3_u8 => decrypt_abe_key_blob_chrome_cng(key_blob),
        v => Err(anyhow!("Unsupported ABE key blob version: {}", v)),
    }
}

fn get_safe(data: &[u8], start: usize, len: usize) -> Result<&[u8]> {
    let end = start + len;
    data.get(start..end).ok_or_else(|| {
        anyhow!(
            "Corrupted ABE key blob: expected bytes {}..{}, got {}",
            start,
            end,
            data.len()
        )
    })
}

fn decrypt_abe_key_blob_chrome_aes(blob: &[u8]) -> Result<Vec<u8>> {
    const GOOGLE_AES_KEY: &[u8] = &[
        0xB3, 0x1C, 0x6E, 0x24, 0x1A, 0xC8, 0x46, 0x72, 0x8D, 0xA9, 0xC1, 0xFA, 0xC4, 0x93, 0x66,
        0x51, 0xCF, 0xFB, 0x94, 0x4D, 0x14, 0x3A, 0xB8, 0x16, 0x27, 0x6B, 0xCC, 0x6D, 0xA0, 0x28,
        0x47, 0x87,
    ];
    let aes_key = Key::<Aes256Gcm>::from_slice(GOOGLE_AES_KEY);
    let cipher = Aes256Gcm::new(aes_key);

    decrypt_abe_key_blob_with_aead(blob, &cipher, "v1 (AES flavor)")
}

fn decrypt_abe_key_blob_chrome_chacha20(blob: &[u8]) -> Result<Vec<u8>> {
    const GOOGLE_CHACHA20_KEY: &[u8] = &[
        0xE9, 0x8F, 0x37, 0xD7, 0xF4, 0xE1, 0xFA, 0x43, 0x3D, 0x19, 0x30, 0x4D, 0xC2, 0x25, 0x80,
        0x42, 0x09, 0x0E, 0x2D, 0x1D, 0x7E, 0xEA, 0x76, 0x70, 0xD4, 0x1F, 0x73, 0x8D, 0x08, 0x72,
        0x96, 0x60,
    ];

    let chacha20_key = chacha20poly1305::Key::from_slice(GOOGLE_CHACHA20_KEY);
    let cipher = ChaCha20Poly1305::new(chacha20_key);

    decrypt_abe_key_blob_with_aead(blob, &cipher, "v2 (ChaCha20 flavor)")
}

fn decrypt_abe_key_blob_with_aead<C>(blob: &[u8], cipher: &C, version: &str) -> Result<Vec<u8>>
where
    C: Aead,
{
    if blob.len() < 60 {
        return Err(anyhow!(
            "Corrupted ABE key blob: expected at least 60 bytes, got {} bytes",
            blob.len()
        ));
    }

    let iv = &blob[0..12];
    let ciphertext = &blob[12..12 + 48];

    debug!("Google ABE {} detected: {:?} {:?}", version, iv, ciphertext);

    let decrypted = cipher
        .decrypt(iv.into(), ciphertext)
        .map_err(|e| anyhow!("Failed to decrypt v20 key with {}: {}", version, e))?;

    Ok(decrypted)
}

fn decrypt_abe_key_blob_chrome_cng(blob: &[u8]) -> Result<Vec<u8>> {
    if blob.len() < 92 {
        return Err(anyhow!(
            "Corrupted ABE key blob: expected at least 92 bytes, got {} bytes",
            blob.len()
        ));
    }

    let encrypted_aes_key: [u8; 32] = blob[0..32].try_into()?;
    let iv: [u8; 12] = blob[32..32 + 12].try_into()?;
    let ciphertext: [u8; 48] = blob[44..44 + 48].try_into()?;

    debug!(
        "Google ABE v3 (CNG flavor) detected: {:?} {:?} {:?}",
        encrypted_aes_key, iv, ciphertext
    );

    // First, decrypt the AES key with CNG API
    let decrypted_aes_key: Vec<u8> = {
        let system_token = start_impersonating()?;
        defer! {
            debug!("Stopping impersonation");
            _ = stop_impersonating(system_token);
        }
        decrypt_with_cng(&encrypted_aes_key)?
    };

    const GOOGLE_XOR_KEY: [u8; 32] = [
        0xCC, 0xF8, 0xA1, 0xCE, 0xC5, 0x66, 0x05, 0xB8, 0x51, 0x75, 0x52, 0xBA, 0x1A, 0x2D, 0x06,
        0x1C, 0x03, 0xA2, 0x9E, 0x90, 0x27, 0x4F, 0xB2, 0xFC, 0xF5, 0x9B, 0xA4, 0xB7, 0x5C, 0x39,
        0x23, 0x90,
    ];

    // XOR the decrypted AES key with the hardcoded key
    let aes_key: Vec<u8> = decrypted_aes_key
        .into_iter()
        .zip(GOOGLE_XOR_KEY)
        .map(|(a, b)| a ^ b)
        .collect();

    // Decrypt the actual ABE key with the decrypted AES key
    let cipher = Aes256Gcm::new(aes_key.as_slice().into());
    let key = cipher
        .decrypt((&iv).into(), ciphertext.as_ref())
        .map_err(|e| anyhow!("Failed to decrypt v20 key with AES-GCM: {}", e))?;

    Ok(key)
}

fn decrypt_with_cng(ciphertext: &[u8]) -> Result<Vec<u8>> {
    // 1. Open the cryptographic provider
    let mut provider = NCRYPT_PROV_HANDLE::default();
    unsafe {
        NCryptOpenStorageProvider(
            &mut provider,
            w!("Microsoft Software Key Storage Provider"),
            0,
        )?;
    };

    // Don't forget to free the provider
    defer!(unsafe {
        _ = Cryptography::NCryptFreeObject(provider.into());
    });

    // 2. Open the key
    let mut key = NCRYPT_KEY_HANDLE::default();
    unsafe {
        NCryptOpenKey(
            provider,
            &mut key,
            w!("Google Chromekey1"),
            CERT_KEY_SPEC::default(),
            NCRYPT_FLAGS::default(),
        )?;
    };

    // Don't forget to free the key
    defer!(unsafe {
        _ = Cryptography::NCryptFreeObject(key.into());
    });

    // 3. Decrypt the data (assume the plaintext is not larger than the ciphertext)
    let mut plaintext = vec![0; ciphertext.len()];
    let mut plaintext_len = 0;
    unsafe {
        Cryptography::NCryptDecrypt(
            key,
            ciphertext.into(),
            None,
            Some(&mut plaintext),
            &mut plaintext_len,
            NCRYPT_SILENT_FLAG,
        )?;
    };

    // In case the plaintext is smaller than the ciphertext
    plaintext.truncate(plaintext_len as usize);

    Ok(plaintext)
}
