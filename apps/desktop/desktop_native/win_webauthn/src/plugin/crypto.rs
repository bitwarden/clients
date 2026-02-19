#![allow(non_snake_case)]
use std::{
    mem::{self, MaybeUninit},
    ptr::NonNull,
};

use windows::{
    core::{GUID, HRESULT, PCWSTR},
    Win32::Security::Cryptography::{
        BCryptCreateHash, BCryptDestroyHash, BCryptFinishHash, BCryptGetProperty, BCryptHashData,
        NCryptImportKey, NCryptOpenStorageProvider, NCryptVerifySignature, BCRYPT_HASH_HANDLE,
        BCRYPT_HASH_LENGTH, BCRYPT_KEY_BLOB, BCRYPT_OBJECT_LENGTH, BCRYPT_PKCS1_PADDING_INFO,
        BCRYPT_PUBLIC_KEY_BLOB, BCRYPT_RSAPUBLIC_MAGIC, BCRYPT_SHA256_ALGORITHM,
        BCRYPT_SHA256_ALG_HANDLE, NCRYPT_FLAGS, NCRYPT_PAD_PKCS1_FLAG,
    },
};

use crate::{util::webauthn_call, ErrorKind, WinWebAuthnError};

webauthn_call!("WebAuthNPluginGetUserVerificationPublicKey" as
/// Retrieve the public key used to verify user verification responses from the OS.
///
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments 
/// - `rclsid`: The CLSID corresponding to this plugin's COM server.
/// - `pcbPublicKey`: A pointer to an unsigned integer, which will be filled in with the length of the buffer at `ppbPublicKey`.
/// - `ppbPublicKey`: A pointer to a [BCRYPT_PUBLIC_KEY_BLOB], which will be written to on success.
///                   On success, this must be freed by a call to [webauthn_plugin_free_public_key_response].
fn webauthn_plugin_get_user_verification_public_key(
    rclsid: *const GUID,
    pcbPublicKey: *mut u32,
    ppbPublicKey: *mut *mut BCRYPT_KEY_BLOB,
) -> HRESULT); // Free using WebAuthNPluginFreePublicKeyResponse

webauthn_call!("WebAuthNPluginGetOperationSigningPublicKey" as
/// Retrieve the public key used to verify plugin operation reqeusts from the OS.
/// 
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments 
/// - `rclsid`: The CLSID corresponding to this plugin's COM server.
/// - `pcbOpSignPubKey`: A pointer to an unsigned integer, which will be filled in with the length of the buffer at `ppbOpSignPubKey`.
/// - `ppbOpSignPubKey`: An indirect pointer to a [BCRYPT_PUBLIC_KEY_BLOB], which will be written to on success.
///                      On success, this must be freed by a call to [webauthn_plugin_free_public_key_response].
fn webauthn_plugin_get_operation_signing_public_key(
    rclsid: *const GUID,
    pcbOpSignPubKey: *mut u32,
    ppbOpSignPubKey: *mut *mut BCRYPT_KEY_BLOB
) -> HRESULT); // Free using WebAuthNPluginFreePublicKeyResponse

webauthn_call!("WebAuthNPluginFreePublicKeyResponse" as
/// Free public key memory retrieved from the OS.
///
/// # Arguments
/// - `pbOpSignPubKey`: A pointer to a [BCRYPT_KEY_BLOB] retrieved from a method in this library.
fn webauthn_plugin_free_public_key_response(
        pbOpSignPubKey: *mut BCRYPT_KEY_BLOB
    ) -> ());

/// Retrieve the public key used to verify plugin operation reqeusts from the OS.
///
/// # Arguments
/// - `clsid`: The CLSID corresponding to this plugin's COM server.
pub(super) fn get_operation_signing_public_key(
    clsid: &GUID,
) -> Result<VerifyingKey, WinWebAuthnError> {
    let mut len = 0;
    let mut uninit = MaybeUninit::uninit();
    let data = unsafe {
        // SAFETY: We check the OS error code before using the written pointer.
        webauthn_plugin_get_operation_signing_public_key(clsid, &mut len, uninit.as_mut_ptr())?
            .ok()
            .map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Failed to retrieve operation signing public key",
                    err,
                )
            })?;
        uninit.assume_init()
    };

    match NonNull::new(data) {
        Some(data) => Ok(VerifyingKey {
            cbPublicKey: len,
            pbPublicKey: data,
        }),
        None => Err(WinWebAuthnError::new(
            ErrorKind::WindowsInternal,
            "Windows returned null pointer when requesting operation signing public key",
        )),
    }
}

/// Retrieve the public key used to verify user verification responses from the OS.
///
/// # Arguments
/// - `clsid`: The CLSID corresponding to this plugin's COM server.
pub(super) fn get_user_verification_public_key(
    clsid: &GUID,
) -> Result<VerifyingKey, WinWebAuthnError> {
    let mut len = 0;
    let mut data = MaybeUninit::uninit();
    // SAFETY: We check the OS error code before using the written pointer.
    unsafe {
        webauthn_plugin_get_user_verification_public_key(clsid, &mut len, data.as_mut_ptr())?
            .ok()
            .map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Failed to retrieve user verification public key",
                    err,
                )
            })?;
        match NonNull::new(data.assume_init()) {
            Some(data) => Ok(VerifyingKey {
                cbPublicKey: len,
                pbPublicKey: data,
            }),
            None => Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Windows returned null pointer when requesting user verification public key",
            )),
        }
    }
}

/// Verify a public key signature over a hash using Windows Crypto APIs.
fn verify_signature(
    public_key: &VerifyingKey,
    hash: &[u8],
    signature: &[u8],
) -> Result<(), windows::core::Error> {
    // Verify the signature over the hash of dataBuffer using the hKey
    unsafe {
        tracing::debug!("Getting provider");
        // Get the provider
        let mut provider = MaybeUninit::uninit();

        NCryptOpenStorageProvider(provider.as_mut_ptr(), PCWSTR::null(), 0)?;
        let provider = provider.assume_init();

        tracing::debug!("Getting key handle");
        // Create a NCrypt key handle from the public key
        let mut key_handle = MaybeUninit::uninit();
        NCryptImportKey(
            provider,
            None,
            BCRYPT_PUBLIC_KEY_BLOB,
            None,
            key_handle.as_mut_ptr(),
            public_key.as_ref(),
            NCRYPT_FLAGS(0),
        )?;
        let key_handle = key_handle.assume_init();

        // BCRYPT_KEY_BLOB is a base structure for all types of keys used in the BCRYPT API.
        // Cf. https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/ns-bcrypt-bcrypt_key_blob.
        //
        // The first field is a "magic" field that denotes the algorithm (RSA,
        // P-256, P-384, etc.) and subtype (public, private; RSA also has a
        // "full private" key that includes the key exponents and coefficients).
        //
        // The exact key types which the OS can return from webauthn.dll
        // operations is not documented, but we have observed at least RSA
        // public keys being used. For forward compatibility, we'll implement
        // RSA, P-256, P-384 and P-512.
        let key_blob = public_key.pbPublicKey.as_ref();
        tracing::debug!("  got key magic: {}", key_blob.Magic);
        let (padding_info, cng_flags) = if key_blob.Magic == BCRYPT_RSAPUBLIC_MAGIC.0 {
            tracing::debug!("Detected RSA key, adding PKCS1 padding");
            let padding_info = BCRYPT_PKCS1_PADDING_INFO {
                pszAlgId: BCRYPT_SHA256_ALGORITHM,
            };
            (Some(padding_info), NCRYPT_PAD_PKCS1_FLAG)
        } else {
            tracing::debug!("Non-RSA key, no PKCS1 padding added");
            (None, NCRYPT_FLAGS(0))
        };

        tracing::debug!("Verifying signature");
        NCryptVerifySignature(
            key_handle,
            padding_info
                .as_ref()
                .map(|padding: &BCRYPT_PKCS1_PADDING_INFO| std::ptr::from_ref(padding).cast()),
            hash,
            signature,
            cng_flags,
        )?;
        tracing::debug!("Verified");
        Ok(())
    }
}

/// Calculate a SHA-256 hash over some data.
pub(super) fn hash_sha256(data: &[u8]) -> Result<Vec<u8>, windows::core::Error> {
    // Hash data
    let sha256 = BcryptHash::sha256()?;
    unsafe { BCryptHashData(sha256.handle, data, 0).ok()? };

    {
        // Get length of SHA256 hash output
        tracing::debug!("Getting length of hash output");
        let hash_output_len = {
            let mut hash_output_len_buf = [0; size_of::<u32>()];
            let mut bytes_read = 0;
            unsafe {
                BCryptGetProperty(
                    BCRYPT_SHA256_ALG_HANDLE.into(),
                    BCRYPT_HASH_LENGTH,
                    Some(&mut hash_output_len_buf),
                    &mut bytes_read,
                    0,
                )
                .ok()?;
            }
            u32::from_ne_bytes(hash_output_len_buf) as usize
        };

        tracing::debug!("  Length of hash output: {hash_output_len}");

        tracing::debug!("Completing hash");
        let hash_buffer: Vec<u8> = {
            let mut hash_buffer: Vec<MaybeUninit<u8>> = Vec::with_capacity(hash_output_len);
            unsafe {
                {
                    // Temporarily treat the buffer byte slice to fit BCryptFinishHash parameter arguments.
                    let hash_slice: &mut [u8] = mem::transmute(hash_buffer.spare_capacity_mut());
                    BCryptFinishHash(sha256.handle, hash_slice, 0).ok()?;
                    // The hash handle is not usable after calling BCryptFinishHash, drop to clean up internal state.
                    drop(sha256);
                }
                // SAFETY: BCryptFinishHash initializes the buffer
                hash_buffer.set_len(hash_output_len);
                mem::transmute(hash_buffer)
            }
        };
        tracing::debug!(" Hash: {hash_buffer:?}");
        Ok(hash_buffer)
    }
}

struct BcryptHash {
    handle: BCRYPT_HASH_HANDLE,
}

impl BcryptHash {
    fn sha256() -> Result<Self, windows::core::Error> {
        unsafe {
            tracing::debug!("Getting length of hash object");
            // Get length of SHA-256 hash object buffer
            let mut len_size_buf = [0; size_of::<u32>()];
            let mut bytes_read = 0;
            BCryptGetProperty(
                BCRYPT_SHA256_ALG_HANDLE.into(),
                BCRYPT_OBJECT_LENGTH,
                Some(&mut len_size_buf),
                &mut bytes_read,
                0,
            )
            .ok()?;
            // SAFETY: We explicitly set the size of the buffer to u32, and we only
            // support platforms where usize is at least 32-bits.
            let len_size: usize = u32::from_ne_bytes(len_size_buf) as usize;
            tracing::debug!("  Length of hash buffer object: {len_size}");
            let mut hash_obj_buf: Vec<MaybeUninit<u8>> = Vec::with_capacity(len_size);
            let mut hash_handle = MaybeUninit::uninit();
            {
                tracing::debug!("Creating hash algorithm handle with buffer object");
                let hash_slice: &mut [u8] = mem::transmute(hash_obj_buf.spare_capacity_mut());
                // Get SHA256 handle
                BCryptCreateHash(
                    BCRYPT_SHA256_ALG_HANDLE,
                    hash_handle.as_mut_ptr(),
                    Some(hash_slice),
                    None,
                    0,
                )
                .ok()?;
            }
            // SAFETY: BCryptCreateHash initializes hash_handle and hash_obj_buf.
            // This memory must be preserved until hash_handle is dropped, but will be cleaned up on
            // call BCryptDestroyHash.
            mem::forget(hash_obj_buf);
            let hash_handle = hash_handle.assume_init();
            Ok(Self {
                handle: hash_handle,
            })
        }
    }
}

impl Drop for BcryptHash {
    fn drop(&mut self) {
        if !self.handle.is_invalid() {
            unsafe {
                if let Err(err) = BCryptDestroyHash(self.handle).to_hresult().ok() {
                    tracing::error!("Failed to clean up hash object: {err}");
                }
            }
        }
    }
}

/// Public key for verifying a signature over an operation request or user verification response buffer.
pub struct VerifyingKey {
    /// Length of buffer
    cbPublicKey: u32,
    /// Pointer to a [BCRYPT_KEY_BLOB]
    pbPublicKey: NonNull<BCRYPT_KEY_BLOB>,
}

impl VerifyingKey {
    /// Verifies a signature over some data with the associated public key.
    pub fn verify_signature(&self, data: &[u8], signature: &[u8]) -> Result<(), WinWebAuthnError> {
        verify_signature(self, data, signature).map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to verify signature",
                err,
            )
        })
    }
}

impl Drop for VerifyingKey {
    fn drop(&mut self) {
        unsafe {
            _ = webauthn_plugin_free_public_key_response(self.pbPublicKey.as_mut());
        }
    }
}

impl AsRef<[u8]> for VerifyingKey {
    fn as_ref(&self) -> &[u8] {
        // SAFETY: We only support platforms where usize >= 32-bts
        let len = self.cbPublicKey as usize;
        // SAFETY: This pointer was given to us from Windows, so we trust it.
        unsafe { std::slice::from_raw_parts(self.pbPublicKey.as_ptr().cast(), len) }
    }
}

#[cfg(test)]
mod tests {
    use std::ptr::NonNull;

    use windows::Win32::Security::Cryptography::{BCRYPT_RSAKEY_BLOB, BCRYPT_RSAPUBLIC_MAGIC};

    use crate::plugin::crypto::{verify_signature, VerifyingKey};

    use super::hash_sha256;

    #[test]
    fn test_sha256_serializes_properly() {
        let data = b"abc";
        let digest = hash_sha256(data).unwrap();
        let expected = &[
            0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
            0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
            0xf2, 0x00, 0x15, 0xad,
        ];
        assert_eq!(expected.as_slice(), digest.as_slice());
    }

    #[test]
    fn test_rsa_signature_verifies_properly() {
        // SHA-256 hash of "abc"
        let digest = &[
            0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
            0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
            0xf2, 0x00, 0x15, 0xad,
        ];
        /*
        Test private key used to create expected signature, generated by OpenSSL

        -----BEGIN PRIVATE KEY-----
        MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDxLbHhDspTRQDM
        NA2vTqznLjBztg6VNHiuS3iM1exO8cCZ2Xnorwj4Sk0LwDJg1KJHdpkQkf8IYMY4
        BmgTciZThoDp1VAqMNDRHRuYZsVRfHxPnVApNos0MOTe/D2+VkexIdf8scaAStAq
        R0XrVp/a+BPHFp9Vbm9LQDMigEXg1orzVLYL/mNadBpqyrjFiRsy7XqPO48T7TDs
        Zm3SxPUhX+9tLOCskXP2/tMxSgwSC1d/r+mn5TaT+M7CDtejzByyIIFMvgEBuD1Z
        2/POm4bz/SRxwvegdvNcTCb0HiNjAPdkvZ5gOOQAXfYPbuDKGs1MhFq1GtW24MN5
        Rp0q0QiFAgMBAAECggEBAOQqd7tUU8MdZ9jIch3kz5zSTNJbbUZo4rb5/W03wR0a
        hzzFyxh/53uGR4eTZ9XFtFTpdXuAs4cIjt5X6URkXK/ucq1FulZ/4j3DTOUMbSZf
        H/ft+vVSfbV9gDkY54zXcXG5c+3DfejHXlJxJUu0ovz0bzmNRGX9WVsWvImqUvGW
        EIDEKsFghLM79DYiGhmifO/gVhGUqaayxQAhcepOOVtwTPk9lpfYoxFQGvHdJKnL
        +vmQ00+K96zzl9WMuR6ypNhnDCOqUBnYrmSIjllr7w6IS1EDPvuu3lrsSWstMpV6
        SvmC+VXOJkDHgtkVMIlVfn2ATfzkqi62ID75f66mNCECgYEA/1zrB034l42B+k0+
        1ELvVytl1pCX1xBGsGTdnBpMS77yTxzCNx4YkMlg7EBygoQN5NC1ziCV1JK08eAr
        CY5YOaGEQNTRWXhWRLUy+Vyc4fxdsHWZSWBXzsRyJIoDuYLyiDRJIlOgRcuHv6jp
        smH+uUBUlq4YEgK+rbdYA21EMNkCgYEA8ce32ZpSjaG6toAP8blT4XFSMgxHUvCX
        7qQfHyPFKy0ANghF5hGgu3dMJ+GcHX3Z88PdwjFW+aABleaXKACvWZ+yK5bm9ijl
        3r3G2yGdbhh0d482rsu4++Hm5g4Ib+JbUnLHX8qeD0px0obPACCHoV2YGCu28Jip
        b9FxBPxOiY0CgYB0kBpsRCgULbDF61qhk0gi9xlOPsRAlBpgTDpoFgz7ilaazBrP
        A/rcpD+Mt8JNVy/sYWSLiY468RiNS/D5NLOK4vI2ka5Z87cVN8zjzGWENikh8hwd
        RU/vfvZHPYSDuoUwrQUxGREQqt31G4pJNbgLIZU7Do7IMd6N9yHCtq6oyQKBgCjA
        RsaQcjWY+sVj1EwjtnWbCgWReDwMfS8lznELMGJUlWKGBnH+qp6uPtHB/vQhkCi7
        7JachlJQm7POR8/gPa3XcspSBt+aiRP/3JJ2mfhCeu7j3o2bnLQnoSlJWDazajz9
        R4lntzhQjdq0ChO1Z+bUxZvdUlo/AN/t5yS1+e7JAoGAegATfCsssVR0Fe07YK/a
        +ufYuH4D0vw8cGzQrYYJKZlf1ra0DCKFZMBaIpNod3NFptQQeFYxIRylSfUtowx6
        /0wrRGqmSe8nZbzeNH7ueYR9VLFOySpA8uH+EIhJfKnAMMPakbYtKJ5nSZaVamjV
        URDbVszNO+xWdwug4sbJToU=
        -----END PRIVATE KEY-----
         */
        // extracted modulus from key above
        let modulus = vec![
            0xf1, 0x2d, 0xb1, 0xe1, 0x0e, 0xca, 0x53, 0x45, 0x00, 0xcc, 0x34, 0x0d, 0xaf, 0x4e,
            0xac, 0xe7, 0x2e, 0x30, 0x73, 0xb6, 0x0e, 0x95, 0x34, 0x78, 0xae, 0x4b, 0x78, 0x8c,
            0xd5, 0xec, 0x4e, 0xf1, 0xc0, 0x99, 0xd9, 0x79, 0xe8, 0xaf, 0x08, 0xf8, 0x4a, 0x4d,
            0x0b, 0xc0, 0x32, 0x60, 0xd4, 0xa2, 0x47, 0x76, 0x99, 0x10, 0x91, 0xff, 0x08, 0x60,
            0xc6, 0x38, 0x06, 0x68, 0x13, 0x72, 0x26, 0x53, 0x86, 0x80, 0xe9, 0xd5, 0x50, 0x2a,
            0x30, 0xd0, 0xd1, 0x1d, 0x1b, 0x98, 0x66, 0xc5, 0x51, 0x7c, 0x7c, 0x4f, 0x9d, 0x50,
            0x29, 0x36, 0x8b, 0x34, 0x30, 0xe4, 0xde, 0xfc, 0x3d, 0xbe, 0x56, 0x47, 0xb1, 0x21,
            0xd7, 0xfc, 0xb1, 0xc6, 0x80, 0x4a, 0xd0, 0x2a, 0x47, 0x45, 0xeb, 0x56, 0x9f, 0xda,
            0xf8, 0x13, 0xc7, 0x16, 0x9f, 0x55, 0x6e, 0x6f, 0x4b, 0x40, 0x33, 0x22, 0x80, 0x45,
            0xe0, 0xd6, 0x8a, 0xf3, 0x54, 0xb6, 0x0b, 0xfe, 0x63, 0x5a, 0x74, 0x1a, 0x6a, 0xca,
            0xb8, 0xc5, 0x89, 0x1b, 0x32, 0xed, 0x7a, 0x8f, 0x3b, 0x8f, 0x13, 0xed, 0x30, 0xec,
            0x66, 0x6d, 0xd2, 0xc4, 0xf5, 0x21, 0x5f, 0xef, 0x6d, 0x2c, 0xe0, 0xac, 0x91, 0x73,
            0xf6, 0xfe, 0xd3, 0x31, 0x4a, 0x0c, 0x12, 0x0b, 0x57, 0x7f, 0xaf, 0xe9, 0xa7, 0xe5,
            0x36, 0x93, 0xf8, 0xce, 0xc2, 0x0e, 0xd7, 0xa3, 0xcc, 0x1c, 0xb2, 0x20, 0x81, 0x4c,
            0xbe, 0x01, 0x01, 0xb8, 0x3d, 0x59, 0xdb, 0xf3, 0xce, 0x9b, 0x86, 0xf3, 0xfd, 0x24,
            0x71, 0xc2, 0xf7, 0xa0, 0x76, 0xf3, 0x5c, 0x4c, 0x26, 0xf4, 0x1e, 0x23, 0x63, 0x00,
            0xf7, 0x64, 0xbd, 0x9e, 0x60, 0x38, 0xe4, 0x00, 0x5d, 0xf6, 0x0f, 0x6e, 0xe0, 0xca,
            0x1a, 0xcd, 0x4c, 0x84, 0x5a, 0xb5, 0x1a, 0xd5, 0xb6, 0xe0, 0xc3, 0x79, 0x46, 0x9d,
            0x2a, 0xd1, 0x08, 0x85,
        ];
        // 65537 = 0x010001, big-endian, 3 bytes
        let public_exponent = [0x01u8, 0x00, 0x01];
        let key_header = BCRYPT_RSAKEY_BLOB {
            Magic: BCRYPT_RSAPUBLIC_MAGIC,
            BitLength: 2048,
            cbPublicExp: public_exponent.len() as u32,
            cbModulus: modulus.len() as u32,
            cbPrime1: 0,
            cbPrime2: 0,
        };

        let mut public_key_bytes: Vec<u8> = unsafe {
            std::slice::from_raw_parts(
                std::ptr::from_ref(&key_header).cast::<u8>(),
                std::mem::size_of::<BCRYPT_RSAKEY_BLOB>(),
            )
        }
        .to_vec();
        public_key_bytes.extend_from_slice(&public_exponent);
        public_key_bytes.extend_from_slice(&modulus);

        // generated with openssl
        let signature = &[
            0x7c, 0x72, 0xba, 0x71, 0x26, 0x00, 0xb5, 0xb8, 0xf6, 0x77, 0xf1, 0x01, 0x74, 0xfe,
            0x27, 0x8a, 0xf8, 0x9b, 0x7e, 0xb7, 0x8b, 0x57, 0x9d, 0xa5, 0x97, 0x80, 0xf7, 0x75,
            0x1c, 0xa3, 0x0d, 0x29, 0xae, 0x37, 0x53, 0x94, 0xab, 0x41, 0x7b, 0x4c, 0x54, 0x07,
            0x0f, 0xf1, 0x84, 0x21, 0x03, 0x9e, 0x43, 0xbd, 0x22, 0xd6, 0x55, 0x67, 0x8d, 0x30,
            0x20, 0xb5, 0xcc, 0xfb, 0x5e, 0xb2, 0x6d, 0x93, 0x78, 0xbc, 0x4f, 0xed, 0xae, 0x8a,
            0x92, 0x6a, 0x1e, 0x4a, 0x32, 0x93, 0xb9, 0x2b, 0xb5, 0xb5, 0xf4, 0x25, 0xb4, 0x27,
            0xa3, 0xab, 0xfe, 0x1d, 0x10, 0x28, 0x36, 0xf9, 0x5b, 0xe3, 0xd0, 0x45, 0xca, 0x71,
            0xd7, 0x7d, 0xc1, 0x81, 0xa0, 0x3d, 0x9e, 0x90, 0xae, 0xec, 0xd6, 0x39, 0xa8, 0x29,
            0x9e, 0xe8, 0x34, 0xde, 0x60, 0xe6, 0x66, 0xdd, 0x9b, 0x20, 0x5f, 0x38, 0x8d, 0x3c,
            0xc5, 0x8b, 0x3f, 0x20, 0xfc, 0xcb, 0xf5, 0xcc, 0xde, 0x57, 0x6a, 0x24, 0x07, 0xe9,
            0xfd, 0x2d, 0x43, 0x1f, 0x57, 0xce, 0x7e, 0xc2, 0x2e, 0x5b, 0xeb, 0x44, 0x4d, 0x56,
            0x9f, 0xc7, 0x45, 0x97, 0xfd, 0x6b, 0xec, 0x30, 0xfa, 0xe4, 0x6b, 0x2b, 0x4b, 0xf3,
            0x70, 0xc7, 0xec, 0x1a, 0xca, 0xf9, 0xa0, 0xea, 0x6c, 0x8e, 0x1d, 0x29, 0xaf, 0x44,
            0x0c, 0x72, 0x80, 0xca, 0x96, 0x15, 0xab, 0x3f, 0xb0, 0x52, 0xcc, 0x8a, 0xbb, 0x73,
            0xbc, 0x47, 0x96, 0x20, 0xd2, 0xe0, 0x3c, 0xa7, 0x93, 0x3a, 0x87, 0x82, 0x5e, 0xc3,
            0x1c, 0xa5, 0x68, 0x1f, 0x02, 0x9e, 0x0d, 0x86, 0x5a, 0xce, 0xb8, 0x16, 0xa0, 0x2c,
            0x57, 0xa2, 0x22, 0xaf, 0x17, 0xd4, 0xd1, 0xa5, 0x82, 0xee, 0x99, 0x51, 0xdd, 0xda,
            0xc6, 0xfa, 0x02, 0x3c, 0xb3, 0x90, 0x26, 0xaf, 0x55, 0xaf, 0xdf, 0x47, 0xd6, 0x7c,
            0x7e, 0x41, 0x17, 0x08,
        ];

        let verify_key = VerifyingKey {
            cbPublicKey: public_key_bytes.len() as u32,
            pbPublicKey: NonNull::new(public_key_bytes.as_mut_ptr().cast()).unwrap(),
        };
        verify_signature(&verify_key, digest, signature).expect("a signature to verify properly");
    }
}
