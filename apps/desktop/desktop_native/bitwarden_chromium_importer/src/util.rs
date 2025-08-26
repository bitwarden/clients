use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use anyhow::{anyhow, Result};
use pbkdf2::{hmac::Hmac, pbkdf2};
use sha1::Sha1;

pub fn split_encrypted_string(encrypted: &[u8]) -> Result<(&str, &[u8])> {
    if encrypted.len() < 3 {
        return Err(anyhow!(
            "Corrupted entry: invalid encrypted string length, expected at least 3 bytes, got {}",
            encrypted.len()
        ));
    }

    let (version, password) = encrypted.split_at(3);
    Ok((std::str::from_utf8(version).unwrap(), password))
}

pub fn split_encrypted_string_and_validate<'a>(
    encrypted: &'a [u8],
    supported_versions: &[&str],
) -> Result<(&'a str, &'a [u8])> {
    let (version, password) = split_encrypted_string(encrypted)?;
    if !supported_versions.contains(&version) {
        return Err(anyhow!("Unsupported encryption version: {}", version));
    }

    Ok((version, password))
}

pub fn decrypt_aes_128_cbc(key: &[u8], iv: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>> {
    let decryptor = cbc::Decryptor::<aes::Aes128>::new_from_slices(key, iv)?;
    let plaintext = decryptor
        .decrypt_padded_vec_mut::<Pkcs7>(ciphertext)
        .map_err(|e| anyhow!("Failed to decrypt: {}", e))?;
    Ok(plaintext)
}

pub fn derive_saltysalt(password: &[u8], iterations: u32) -> Result<Vec<u8>> {
    let mut key = vec![0u8; 16];
    pbkdf2::<Hmac<Sha1>>(password, b"saltysalt", iterations, &mut key)
        .map_err(|e| anyhow!("Failed to derive master key: {}", e))?;
    Ok(key)
}
