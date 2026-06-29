use std::{
    mem::{ManuallyDrop, MaybeUninit},
    ptr::NonNull,
};

use windows::core::GUID;

use crate::{
    api::{
        plugin::{
            com::ComBufferExt,
            crypto::{self, OwnedRequestHash, Signature},
            PluginGetAssertionRequest, PluginMakeCredentialRequest, VerifyingKey,
        },
        sys::plugin::{
            webauthn_plugin_get_operation_signing_public_key, WEBAUTHN_PLUGIN_OPERATION_REQUEST,
            WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
        },
    },
    ErrorKind, WinWebAuthnError,
};

// Generic Operation types

/// Extract the signature from an operation request.
///
/// The signature is made by the OS over the SHA-256 hash of the operation
/// request buffer using the signing key created during authenticator
/// registration and retrievable via
/// [webauthn_plugin_get_operation_signing_public_key](crate::plugin::crypto::webauthn_plugin_get_operation_signing_public_key).
///
/// # Safety
/// The caller must ensure that `request.pbRequestSignature` points to a valid non-null byte
/// string of length `request.cbRequestSignature`.
pub(in crate::api::plugin) unsafe fn get_request_signature(
    request: &WEBAUTHN_PLUGIN_OPERATION_REQUEST,
) -> Result<Signature<'_>, WinWebAuthnError> {
    if request.pbRequestSignature.is_null() {
        return Err(WinWebAuthnError::new(
            ErrorKind::InvalidArguments,
            "request signature buffer pointer is null",
        ));
    } else if !request.pbRequestSignature.is_aligned() {
        return Err(WinWebAuthnError::new(
            ErrorKind::InvalidArguments,
            "request signature buffer pointer is not aligned",
        ));
    }

    // SAFETY: The caller must make sure that the encoded request is valid.
    let signature = unsafe {
        std::slice::from_raw_parts(
            request.pbRequestSignature,
            request.cbRequestSignature as usize,
        )
    };
    Ok(Signature::new(signature))
}

/// Calculate a SHA-256 hash over the request.
///
/// # Safety
/// The caller must ensure that: `request.pbEncodedRequest` points to a valid non-null byte
/// string of length `request.cbEncodedRequest`.
pub(in crate::api::plugin) unsafe fn get_request_hash(
    request: &WEBAUTHN_PLUGIN_OPERATION_REQUEST,
) -> Result<OwnedRequestHash, WinWebAuthnError> {
    if request.pbEncodedRequest.is_null() {
        return Err(WinWebAuthnError::new(
            ErrorKind::InvalidArguments,
            "request buffer pointer is null",
        ));
    } else if !request.pbEncodedRequest.is_aligned() {
        return Err(WinWebAuthnError::new(
            ErrorKind::InvalidArguments,
            "request buffer pointer is not aligned",
        ));
    }

    // SAFETY: The caller must make sure that the encoded request is valid.
    let request_data = unsafe {
        std::slice::from_raw_parts(request.pbEncodedRequest, request.cbEncodedRequest as usize)
    };
    let request_hash = crypto::hash_sha256(request_data).map_err(|err| {
        WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "failed to hash request", err)
    })?;
    Ok(OwnedRequestHash(request_hash))
}

pub(in crate::api::plugin) trait OperationRequest<'a> {
    fn transaction_id(&self) -> GUID;

    unsafe fn try_from_operation_request(
        request: &'a WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        request_hash: OwnedRequestHash,
    ) -> Result<Self, WinWebAuthnError>
    where
        Self: Sized;
}

impl<'a> OperationRequest<'a> for PluginGetAssertionRequest<'a> {
    fn transaction_id(&self) -> GUID {
        self.transaction_id
    }

    unsafe fn try_from_operation_request(
        request: &'a WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        request_hash: OwnedRequestHash,
    ) -> Result<Self, WinWebAuthnError>
    where
        Self: Sized,
    {
        Self::try_from_ptr(request, request_hash)
    }
}

impl<'a> OperationRequest<'a> for PluginMakeCredentialRequest<'a> {
    fn transaction_id(&self) -> GUID {
        self.transaction_id
    }

    unsafe fn try_from_operation_request(
        request: &'a WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        request_hash: OwnedRequestHash,
    ) -> Result<Self, WinWebAuthnError>
    where
        Self: Sized,
    {
        Self::try_from_ptr(request, request_hash)
    }
}

pub(crate) struct OperationResponse {
    inner: NonNull<WEBAUTHN_PLUGIN_OPERATION_RESPONSE>,
}

// SAFETY: OperationResponse wraps a pointer to a Windows-provided response buffer (not a COM
// object). The COM STA thread is blocked waiting for the method to return while the buffer is
// in-flight, so writing from another thread is safe when synchronized via Mutex.
//
// This invariant depends on the single-threaded apartment (STA) dispatch model: the COM server is
// initialized with COINIT_APARTMENTTHREADED and runs a single message loop, so interface calls are
// serialized and the buffer is only ever touched by one thread at a time. A future change to MTA
// or a worker-thread dispatch model would invalidate this `Send` impl.
unsafe impl Send for OperationResponse {}

impl OperationResponse {
    /// # Safety
    /// The caller must ensure that `ptr` points to a valid
    /// [`WEBAUTHN_PLUGIN_OPERATION_RESPONSE`], e.g. `pbEncodedResponse` must be
    /// a COM-allocated buffer of bytes of length `cbEncodedResponse`.
    pub(in crate::api::plugin) unsafe fn new(
        ptr: NonNull<WEBAUTHN_PLUGIN_OPERATION_RESPONSE>,
    ) -> Result<Self, WinWebAuthnError> {
        if !ptr.is_aligned() {
            return Err(WinWebAuthnError::new(
                ErrorKind::InvalidArguments,
                "Response buffer is not aligned",
            ));
        }
        Ok(Self { inner: ptr })
    }

    /// Copies data as COM-allocated buffer and writes to response pointer.
    ///
    /// Safety constraints: [response] must point to a valid
    /// WEBAUTHN_PLUGIN_OPERATION_RESPONSE struct.
    pub(crate) fn write(&mut self, data: &[u8]) -> Result<(), WinWebAuthnError> {
        let len = match data.len().try_into() {
            Ok(len) => len,
            Err(err) => {
                return Err(WinWebAuthnError::with_cause(
                    ErrorKind::Serialization,
                    "Response is too long to return to OS",
                    err,
                ));
            }
        };
        let buf = data.to_com_buffer();
        // SAFETY: We verified that the pointer is aligned and non-null.
        unsafe {
            self.inner.write(WEBAUTHN_PLUGIN_OPERATION_RESPONSE {
                cbEncodedResponse: len,
                pbEncodedResponse: buf.as_mut_ptr(),
            });
        }
        // Leak the buffer to the COM implementation
        _ = ManuallyDrop::new(buf);
        Ok(())
    }
}

/// Retrieve the public key used to verify plugin operation requests from the OS.
///
/// # Arguments
/// - `clsid`: The CLSID corresponding to this plugin's COM server.
pub(crate) fn get_operation_signing_public_key(
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
        Some(data) => {
            let len = len.try_into().map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Received invalid length from Windows",
                    err,
                )
            })?;
            // SAFETY: The data was received by Windows.
            let key = unsafe { VerifyingKey::new(data, len)? };
            Ok(key)
        }
        None => Err(WinWebAuthnError::new(
            ErrorKind::WindowsInternal,
            "Windows returned null pointer when requesting operation signing public key",
        )),
    }
}
