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
