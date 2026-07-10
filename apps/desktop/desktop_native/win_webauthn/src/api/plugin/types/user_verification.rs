use std::{mem::MaybeUninit, ptr::NonNull};

use windows::{
    core::GUID,
    Win32::Foundation::{HWND, NTE_USER_CANCELLED, S_OK},
};

use crate::{
    api::{
        plugin::{
            com::{ComBuffer, ComBufferExt},
            crypto::{RequestHash, Signature},
            VerifyingKey,
        },
        sys::plugin::{
            webauthn_plugin_free_user_verification_response,
            webauthn_plugin_get_user_verification_public_key,
            webauthn_plugin_perform_user_verification, WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST,
        },
        WindowsString,
    },
    plugin::Clsid,
    ErrorKind, WinWebAuthnError,
};

#[derive(Debug)]
pub struct PluginUserVerificationRequest {
    /// Windows handle of the top-level window displayed by the plugin and
    /// currently is in foreground as part of the ongoing WebAuthn operation.
    pub window_handle: HWND,

    /// The WebAuthn transaction id from the WEBAUTHN_PLUGIN_OPERATION_REQUEST
    pub transaction_id: GUID,

    /// The username attached to the credential that is in use for this WebAuthn
    /// operation.
    pub user_name: String,

    /// A text hint displayed on the Windows Hello prompt.
    pub display_hint: Option<String>,
}

pub(crate) struct PluginUserVerificationRequestRaw {
    inner: WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST,
    _user_name: ComBuffer,
    _display_hint: Option<ComBuffer>,
}

impl From<&PluginUserVerificationRequest> for PluginUserVerificationRequestRaw {
    fn from(value: &PluginUserVerificationRequest) -> Self {
        let user_name = value.user_name.to_utf16().to_com_buffer();
        let hint = value
            .display_hint
            .as_ref()
            .map(|d| d.to_utf16().to_com_buffer());
        let inner = WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST {
            hwnd: value.window_handle,
            rguidTransactionId: &value.transaction_id,
            pwszUsername: user_name.as_ptr(),
            pwszDisplayHint: hint.as_ref().map_or(std::ptr::null(), |buf| buf.as_ptr()),
        };
        PluginUserVerificationRequestRaw {
            inner,
            _user_name: user_name,
            _display_hint: hint,
        }
    }
}

/// Response details from user verification.
pub struct PluginUserVerificationResponse {
    pub transaction_id: GUID,
    /// Bytes of the signature over the response.
    pub signature: Vec<u8>,
}

/// Sends a request to prompt for user verification.
///
/// On success, returns the signature of the SHA-256 hash of the original
/// operation request buffer corresponding to `request.transaction_id`.
pub(crate) fn perform_user_verification(
    request: &PluginUserVerificationRequestRaw,
    public_key: &VerifyingKey,
    operation_request_hash: &[u8],
) -> Result<(), WinWebAuthnError> {
    let mut response_len = 0;
    let mut response_ptr = MaybeUninit::uninit();
    let hresult = unsafe {
        webauthn_plugin_perform_user_verification(
            &request.inner,
            &mut response_len,
            response_ptr.as_mut_ptr(),
        )?
    };
    let signature = match hresult {
        S_OK => {
            // SAFETY: Windows returned successful response code and length, so we
            // assume that the data and length are initialized
            let signature = unsafe {
                let response_ptr = response_ptr.assume_init();
                if response_ptr.is_null() {
                    return Err(WinWebAuthnError::new(
                        ErrorKind::WindowsInternal,
                        "Windows returned a null pointer for user verification response",
                    ));
                }
                // SAFETY: Windows only runs on platforms where usize >= u32;
                let len = response_len as usize;
                let signature = std::slice::from_raw_parts(response_ptr, len).to_vec();
                webauthn_plugin_free_user_verification_response(response_ptr)?;
                signature
            };
            Ok(signature)
        }
        NTE_USER_CANCELLED => Err(WinWebAuthnError::new(
            ErrorKind::Other,
            "User cancelled user verification",
        )),
        _ => Err(WinWebAuthnError::with_cause(
            ErrorKind::WindowsInternal,
            "Unknown error occurred while performing user verification",
            windows::core::Error::from_hresult(hresult),
        )),
    }?;
    public_key.verify_signature(
        RequestHash::new(operation_request_hash),
        Signature::new(&signature),
    )?;
    Ok(())
}

/// Retrieve the public key used to verify user verification responses from the OS.
///
/// # Arguments
/// - `clsid`: The CLSID corresponding to this plugin's COM server.
pub(crate) fn get_user_verification_public_key(
    clsid: Clsid,
) -> Result<VerifyingKey, WinWebAuthnError> {
    let mut len = 0;
    let mut data = MaybeUninit::uninit();
    // SAFETY: We check the OS error code before using the written pointer.
    let data = unsafe {
        webauthn_plugin_get_user_verification_public_key(
            &clsid.as_guid(),
            &mut len,
            data.as_mut_ptr(),
        )?
        .ok()
        .map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to retrieve user verification public key",
                err,
            )
        })?;
        data.assume_init()
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
            "Windows returned null pointer when requesting user verification public key",
        )),
    }
}
