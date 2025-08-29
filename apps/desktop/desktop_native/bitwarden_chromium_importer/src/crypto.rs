//! Cryptographic primitives used in the SDK

use anyhow::{Result, anyhow};

use aes::cipher::{
    block_padding::Pkcs7, generic_array::GenericArray, typenum::U32, BlockDecryptMut, KeyIvInit,
};

pub fn decrypt_aes256(iv: &[u8; 16], data: &[u8], key: GenericArray<u8, U32>) -> Result<Vec<u8>> {
    let iv = GenericArray::from_slice(iv);
    let mut data = data.to_vec();
    return cbc::Decryptor::<aes::Aes256>::new(&key, iv)
        .decrypt_padded_mut::<Pkcs7>(&mut data)
        .map_err(|_| anyhow!("Failed to decrypt data"))?;

    Ok(data)
}
