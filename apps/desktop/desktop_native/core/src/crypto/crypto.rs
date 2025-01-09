//! Cryptographic primitives used in the SDK

use aes::cipher::{
    block_padding::Pkcs7, generic_array::GenericArray, typenum::U32, BlockDecryptMut,
    BlockEncryptMut, KeyIvInit,
};

use crate::error::{CryptoError, KdfParamError, Result};

use super::CipherString;

pub fn decrypt_aes256(iv: &[u8; 16], data: &[u8], key: GenericArray<u8, U32>) -> Result<Vec<u8>> {
    let iv = GenericArray::from_slice(iv);
    let mut data = data.to_vec();
    let decrypted_key_slice = cbc::Decryptor::<aes::Aes256>::new(&key, iv)
        .decrypt_padded_mut::<Pkcs7>(&mut data)
        .map_err(|_| CryptoError::KeyDecrypt)?;

    // Data is decrypted in place and returns a subslice of the original Vec, to avoid cloning it, we truncate to the subslice length
    let decrypted_len = decrypted_key_slice.len();
    data.truncate(decrypted_len);

    Ok(data)
}

pub fn encrypt_aes256(
    data_dec: &[u8],
    iv: [u8; 16],
    key: GenericArray<u8, U32>,
) -> Result<CipherString> {
    let data = cbc::Encryptor::<aes::Aes256>::new(&key, &iv.into())
        .encrypt_padded_vec_mut::<Pkcs7>(data_dec);

    Ok(CipherString::AesCbc256_B64 { iv, data })
}

pub fn argon2(
    secret: &[u8],
    salt: &[u8],
    iterations: u32,
    memory: u32,
    parallelism: u32,
) -> Result<[u8; 32]> {
    use argon2::*;

    let params = Params::new(memory, iterations, parallelism, Some(32)).map_err(|e| {
        KdfParamError::InvalidParams(format!("Argon2 parameters are invalid: {e}",))
    })?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut hash = [0u8; 32];
    argon
        .hash_password_into(secret, salt, &mut hash)
        .map_err(|e| KdfParamError::InvalidParams(format!("Argon2 hashing failed: {e}",)))?;

    // Argon2 is using some stack memory that is not zeroed. Eventually some function will
    // overwrite the stack, but we use this trick to force the used stack to be zeroed.
    #[inline(never)]
    fn clear_stack() {
        std::hint::black_box([0u8; 4096]);
    }
    clear_stack();
    Ok(hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2() {
        let test_hash: [u8; 32] = [
            112, 200, 85, 209, 100, 4, 246, 146, 117, 180, 152, 44, 103, 198, 75, 14, 166, 77, 201,
            22, 62, 178, 87, 224, 95, 209, 253, 68, 166, 209, 47, 218,
        ];
        let secret = b"supersecurepassword";
        let salt = b"mail@example.com";
        let iterations = 3;
        let memory = 1024 * 64;
        let parallelism = 4;

        let hash = argon2(secret, salt, iterations, memory, parallelism).unwrap();
        assert_eq!(hash, test_hash,);
    }
}
