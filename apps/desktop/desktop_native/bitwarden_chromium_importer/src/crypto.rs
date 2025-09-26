//! Cryptographic primitives used in the SDK

use anyhow::{anyhow, Result};

use aes::cipher::{
    block_padding::Pkcs7, generic_array::GenericArray, typenum::U32, BlockDecryptMut, KeyIvInit,
};

pub fn decrypt_aes256(iv: &[u8; 16], data: &[u8], key: GenericArray<u8, U32>) -> Result<Vec<u8>> {
    let iv = GenericArray::from_slice(iv);
    let mut data = data.to_vec();
    cbc::Decryptor::<aes::Aes256>::new(&key, iv)
        .decrypt_padded_mut::<Pkcs7>(&mut data)
        .map_err(|_| anyhow!("Failed to decrypt data"))?;

    Ok(data)
}

#[cfg(test)]
mod tests {
    use aes::cipher::{
        generic_array::{sequence::GenericSequence, GenericArray},
        ArrayLength,
    };
    use base64::{engine::general_purpose::STANDARD, Engine};

    pub fn generate_vec(length: usize, offset: u8, increment: u8) -> Vec<u8> {
        (0..length).map(|i| offset + i as u8 * increment).collect()
    }
    pub fn generate_generic_array<N: ArrayLength<u8>>(
        offset: u8,
        increment: u8,
    ) -> GenericArray<u8, N> {
        GenericArray::generate(|i| offset + i as u8 * increment)
    }

    #[test]
    fn test_decrypt_aes256() {
        let iv = generate_vec(16, 0, 1);
        let iv: &[u8; 16] = iv.as_slice().try_into().unwrap();
        let key = generate_generic_array(0, 1);
        let data: Vec<u8> = STANDARD.decode("ByUF8vhyX4ddU9gcooznwA==").unwrap();

        let decrypted = super::decrypt_aes256(iv, &data, key).unwrap();

        assert_eq!(String::from_utf8(decrypted).unwrap(), "EncryptMe!\u{6}\u{6}\u{6}\u{6}\u{6}\u{6}");
    }
}
