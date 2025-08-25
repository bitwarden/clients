//! Cryptographic primitives used in the SDK

use anyhow::{Result, anyhow};

use aes::cipher::{
    block_padding::Pkcs7, generic_array::GenericArray, typenum::U32, BlockDecryptMut, KeyIvInit,
};

pub fn decrypt_aes256(iv: &[u8; 16], data: &[u8], key: GenericArray<u8, U32>) -> Result<Vec<u8>> {
    let iv = GenericArray::from_slice(iv);
    let mut data = data.to_vec();
    let decrypted_key_slice = cbc::Decryptor::<aes::Aes256>::new(&key, iv)
        .decrypt_padded_mut::<Pkcs7>(&mut data)
        .map_err(|_| anyhow!("Failed to decrypt data"))?;

    // Data is decrypted in place and returns a subslice of the original Vec, to avoid cloning it, we truncate to the subslice length
    let decrypted_len = decrypted_key_slice.len();
    data.truncate(decrypted_len);

    Ok(data)
}
