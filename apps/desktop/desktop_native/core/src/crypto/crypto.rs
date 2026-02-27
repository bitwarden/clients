//! Cryptographic primitives used in the SDK

use aes::cipher::{
    block_padding::Pkcs7, generic_array::GenericArray, typenum::U32, BlockDecryptMut,
    BlockEncryptMut, KeyIvInit,
};

use super::CipherString;
use crate::error::{CryptoError, Result};

pub fn decrypt_aes256(iv: &[u8; 16], data: &[u8], key: GenericArray<u8, U32>) -> Result<Vec<u8>> {
    let iv = GenericArray::from_slice(iv);
    let mut data = data.to_vec();
    let decrypted_key_slice = cbc::Decryptor::<aes::Aes256>::new(&key, iv)
        .decrypt_padded_mut::<Pkcs7>(&mut data)
        .map_err(|_| CryptoError::KeyDecrypt)?;

    // Data is decrypted in place and returns a subslice of the original Vec, to avoid cloning it,
    // we truncate to the subslice length
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
