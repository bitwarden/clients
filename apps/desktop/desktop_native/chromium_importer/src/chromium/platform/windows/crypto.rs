use anyhow::{anyhow, Result};
use windows::Win32::{
    Foundation::{LocalFree, HLOCAL},
    Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB},
};

/// Rust friendly wrapper around CryptUnprotectData
///
/// Decrypts the data passed in using the `CryptUnprotectData` api.
pub fn crypt_unprotect_data(data: &[u8], flags: u32) -> Result<Vec<u8>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let data_in = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };

    let mut data_out = CRYPT_INTEGER_BLOB::default();

    let result = unsafe {
        CryptUnprotectData(
            &data_in,
            None,  // ppszDataDescr: Option<*mut PWSTR>
            None,  // pOptionalEntropy: Option<*const CRYPT_INTEGER_BLOB>
            None,  // pvReserved: Option<*const std::ffi::c_void>
            None,  // pPromptStruct: Option<*const CRYPTPROTECT_PROMPTSTRUCT>
            flags, // dwFlags: u32
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

    let output = output_slice.to_vec();

    unsafe {
        if !data_out.pbData.is_null() {
            LocalFree(Some(HLOCAL(out_blob.pbData as *mut _)));
        }
    }

    Ok(output)
}
