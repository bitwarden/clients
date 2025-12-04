#![allow(non_snake_case)]
use std::{mem::MaybeUninit, ptr::NonNull};

use windows::{
    core::{GUID, HRESULT, PCWSTR},
    Win32::{
        Foundation::E_INVALIDARG,
        Security::Cryptography::{
            BCryptCreateHash, BCryptFinishHash, BCryptGetProperty, BCryptHashData, NCryptImportKey,
            NCryptOpenStorageProvider, NCryptVerifySignature, BCRYPT_HASH_LENGTH, BCRYPT_KEY_BLOB,
            BCRYPT_OBJECT_LENGTH, BCRYPT_PKCS1_PADDING_INFO, BCRYPT_PUBLIC_KEY_BLOB,
            BCRYPT_RSAPUBLIC_MAGIC, BCRYPT_SHA256_ALGORITHM, BCRYPT_SHA256_ALG_HANDLE,
            NCRYPT_FLAGS, NCRYPT_PAD_PKCS1_FLAG,
        },
    },
};

use crate::{util::webauthn_call, ErrorKind, WinWebAuthnError};

webauthn_call!("WebAuthNPluginGetUserVerificationPublicKey" as fn  webauthn_plugin_get_user_verification_public_key(
        rclsid: *const GUID,
        pcbPublicKey: *mut u32,
        ppbPublicKey: *mut *mut u8) -> HRESULT); // Free using WebAuthNPluginFreePublicKeyResponse

webauthn_call!("WebAuthNPluginGetOperationSigningPublicKey" as fn webauthn_plugin_get_operation_signing_public_key(
        rclsid: *const GUID,
        pcbOpSignPubKey: *mut u32,
        ppbOpSignPubKey: *mut *mut u8
    ) -> HRESULT); // Free using WebAuthNPluginFreePublicKeyResponse

webauthn_call!("WebAuthNPluginFreePublicKeyResponse" as fn webauthn_plugin_free_public_key_response(
        pbOpSignPubKey: *mut u8
    ) -> ());

pub(super) fn get_operation_signing_public_key(
    clsid: &GUID,
) -> Result<SigningKey, WinWebAuthnError> {
    let mut len = 0;
    let mut data = MaybeUninit::uninit();
    webauthn_plugin_get_operation_signing_public_key(clsid, &mut len, data.as_mut_ptr())?
        .ok()
        .map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to retrieve operation signing public key",
                err,
            )
        })?;
    unsafe {
        match NonNull::new(data.assume_init()) {
            Some(data) => Ok(SigningKey {
                cbPublicKey: len,
                pbPublicKey: data,
            }),
            None => Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Windows returned null pointer when requesting operation signing public key",
            )),
        }
    }
}

pub(super) fn get_user_verification_public_key(
    clsid: &GUID,
) -> Result<SigningKey, WinWebAuthnError> {
    let mut len = 0;
    let mut data = MaybeUninit::uninit();
    webauthn_plugin_get_user_verification_public_key(clsid, &mut len, data.as_mut_ptr())?
        .ok()
        .map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to retrieve user verification public key",
                err,
            )
        })?;
    unsafe {
        match NonNull::new(data.assume_init()) {
            Some(data) => Ok(SigningKey {
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

fn verify_signature(
    public_key: &SigningKey,
    data: &[u8],
    signature: &[u8],
) -> Result<(), windows::core::Error> {
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

        // Verify the signature over the hash of dataBuffer using the hKey

        tracing::debug!("Getting length of hash buffer object");
        // Get length of SHA-256 buffer
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
        let mut hash_obj_buf = Vec::with_capacity(len_size);
        hash_obj_buf.set_len(len_size);

        tracing::debug!("Creating hash algorithm handle with buffer object");
        // Get SHA256 handle
        let mut hash_handle = MaybeUninit::uninit();
        BCryptCreateHash(
            BCRYPT_SHA256_ALG_HANDLE,
            hash_handle.as_mut_ptr(),
            Some(hash_obj_buf.as_mut_slice()),
            None,
            0,
        )
        .ok()?;
        let hash_handle = hash_handle.assume_init();

        tracing::debug!("Hashing data");
        // Hash data
        BCryptHashData(hash_handle, data, 0).ok()?;

        // Get length of SHA256 hash output
        tracing::debug!("Getting length of hash output");
        let mut hash_output_len_buf = [0; size_of::<u32>()];
        let mut bytes_read = 0;
        BCryptGetProperty(
            BCRYPT_SHA256_ALG_HANDLE.into(),
            BCRYPT_HASH_LENGTH,
            Some(&mut hash_output_len_buf),
            &mut bytes_read,
            0,
        )
        .ok()?;

        let hash_output_len = u32::from_ne_bytes(hash_output_len_buf) as usize;
        tracing::debug!("  Length of hash output: {hash_output_len}");

        tracing::debug!("Completing hash");
        let mut hash_buffer = Vec::with_capacity(hash_output_len);
        hash_buffer.set_len(hash_output_len);
        BCryptFinishHash(hash_handle, hash_buffer.as_mut_slice(), 0).ok()?;
        tracing::debug!(" Hash: {hash_buffer:?}");

        tracing::debug!("Trying to read public key slice as key blob");
        let public_key = public_key.as_ref();
        if public_key.len() < size_of::<BCRYPT_KEY_BLOB>() {
            return Err(windows::core::Error::from_hresult(E_INVALIDARG));
        }
        let key_blob: &BCRYPT_KEY_BLOB = &*public_key.as_ptr().cast();
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
            hash_buffer.as_slice(),
            signature,
            cng_flags,
        )?;
        tracing::debug!("Verified");
        Ok(())
    }
}

/// Signing key for an operation request or user verification response buffer.
pub struct SigningKey {
    cbPublicKey: u32,
    pbPublicKey: NonNull<u8>,
}

impl SigningKey {
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
impl Drop for SigningKey {
    fn drop(&mut self) {
        unsafe {
            _ = webauthn_plugin_free_public_key_response(self.pbPublicKey.as_mut());
        }
    }
}
impl AsRef<[u8]> for SigningKey {
    fn as_ref(&self) -> &[u8] {
        // SAFETY: We only support platforms where usize >= 32-bts
        let len = self.cbPublicKey as usize;
        // SAFETY: This pointer was given to us from Windows, so we trust it.
        unsafe { std::slice::from_raw_parts(self.pbPublicKey.as_ptr(), len) }
    }
}
