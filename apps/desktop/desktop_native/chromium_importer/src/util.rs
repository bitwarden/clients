use anyhow::{anyhow, Result};

fn split_encrypted_string(encrypted: &[u8]) -> Result<(&str, &[u8])> {
    if encrypted.len() < 3 {
        return Err(anyhow!(
            "Corrupted entry: invalid encrypted string length, expected at least 3 bytes, got {}",
            encrypted.len()
        ));
    }

    let (version, password) = encrypted.split_at(3);
    Ok((std::str::from_utf8(version)?, password))
}

/// A Chromium password consists of three parts:
/// - Version (3 bytes): "v10", "v11", etc.
/// - Cipher text (chunks of 16 bytes)
/// - Padding (1-15 bytes)
///
/// This function splits the encrypted byte slice into version and cipher text.
/// Padding is included and handled by the underlying cryptographic library.
pub(crate) fn split_encrypted_string_and_validate<'a>(
    encrypted: &'a [u8],
    supported_versions: &[&str],
) -> Result<(&'a str, &'a [u8])> {
    let (version, password) = split_encrypted_string(encrypted)?;
    if !supported_versions.contains(&version) {
        return Err(anyhow!("Unsupported encryption version: {}", version));
    }

    Ok((version, password))
}

/// Decrypt using AES-128 in CBC mode.
#[cfg(any(target_os = "linux", target_os = "macos", test))]
pub(crate) fn decrypt_aes_128_cbc(key: &[u8], iv: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>> {
    use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};

    cbc::Decryptor::<aes::Aes128>::new_from_slices(key, iv)?
        .decrypt_padded_vec_mut::<Pkcs7>(ciphertext)
        .map_err(|e| anyhow!("Failed to decrypt: {}", e))
}

/// Derives a PBKDF2 key from the static "saltysalt" salt with the given password and iteration count.
#[cfg(any(target_os = "linux", target_os = "macos"))]
pub(crate) fn derive_saltysalt(password: &[u8], iterations: u32) -> Result<Vec<u8>> {
    use pbkdf2::{hmac::Hmac, pbkdf2};
    use sha1::Sha1;

    let mut key = vec![0u8; 16];
    pbkdf2::<Hmac<Sha1>>(password, b"saltysalt", iterations, &mut key)
        .map_err(|e| anyhow!("Failed to derive master key: {}", e))?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use aes::cipher::{
        block_padding::Pkcs7,
        generic_array::{sequence::GenericSequence, GenericArray},
        ArrayLength, BlockEncryptMut, KeyIvInit,
    };

    const LENGTH16: usize = 16;
    const LENGTH10: usize = 10;
    const LENGTH0: usize = 0;

    fn generate_vec(length: usize, offset: u8, increment: u8) -> Vec<u8> {
        (0..length).map(|i| offset + i as u8 * increment).collect()
    }

    fn generate_generic_array<N: ArrayLength<u8>>(
        offset: u8,
        increment: u8,
    ) -> GenericArray<u8, N> {
        GenericArray::generate(|i| offset + i as u8 * increment)
    }

    fn run_split_encrypted_string_test<'a, const N: usize>(
        successfully_split: bool,
        plaintext_to_encrypt: &'a str,
        version: &'a str,
        password: Vec<u8>,
    ) {
        let res = super::split_encrypted_string(plaintext_to_encrypt.as_bytes());

        assert_eq!(res.is_ok(), successfully_split);
        if let Ok((version_found, password_found)) = res {
            assert_eq!(version_found, version);
            assert_eq!(password_found.len(), password.len());
            assert_eq!(password_found, &password);
        }
    }

    #[test]
    fn test_split_encrypted_string_success_v10() {
        run_split_encrypted_string_test::<LENGTH0>(
            true,
            "v10EncryptMe!",
            "v10",
            vec![69, 110, 99, 114, 121, 112, 116, 77, 101, 33],
        );
    }

    #[test]
    fn test_split_encrypted_string_fail_no_password() {
        run_split_encrypted_string_test::<LENGTH10>(true, "v09", "v09", Vec::<u8>::new());
    }

    #[test]
    fn test_split_encrypted_string_fail_too_small() {
        run_split_encrypted_string_test::<LENGTH10>(false, "v0", "v0", vec![0]);
    }

    fn run_split_encrypted_string_and_validate_test(
        valid_version: bool,
        plaintext_to_encrypt: &str,
        supported_versions: &[&str],
    ) {
        let result = super::split_encrypted_string_and_validate(
            plaintext_to_encrypt.as_bytes(),
            supported_versions,
        );
        assert_eq!(result.is_ok(), valid_version);
    }

    #[test]
    fn test_split_encrypted_string_and_validate_version_found_from_single_version() {
        run_split_encrypted_string_and_validate_test(true, "v10EncryptMe!", &["v10"]);
    }

    #[test]
    fn test_split_encrypted_string_and_validate_version_found_from_multiple_versions() {
        run_split_encrypted_string_and_validate_test(true, "v10EncryptMe!", &["v11", "v10"]);
    }

    #[test]
    fn test_split_encrypted_string_and_validate_version_not_found() {
        run_split_encrypted_string_and_validate_test(false, "v10EncryptMe!", &["v11", "v12"]);
    }

    #[test]
    fn test_split_encrypted_string_and_validate_version_not_found_empty_list() {
        run_split_encrypted_string_and_validate_test(false, "v10EncryptMe!", &[]);
    }

    #[test]
    fn test_decrypt_aes_128_cbc() {
        let offset = 0;
        let increment = 1;

        let iv = generate_vec(LENGTH16, offset, increment);
        let iv: &[u8; LENGTH16] = iv.as_slice().try_into().unwrap();
        let key: GenericArray<u8, _> = generate_generic_array(0, 1);
        let data = cbc::Encryptor::<aes::Aes128>::new(&key, iv.into())
            .encrypt_padded_vec_mut::<Pkcs7>("EncryptMe!".as_bytes());

        let decrypted = super::decrypt_aes_128_cbc(&key, iv, &data).unwrap();

        assert_eq!(String::from_utf8(decrypted).unwrap(), "EncryptMe!");
    }
}
