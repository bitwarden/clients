pub(crate) mod com;
pub(crate) mod crypto;
pub(crate) mod types;

use std::{error::Error, ptr::NonNull};

use types::*;
pub use types::{
    PluginAddAuthenticatorOptions, PluginAddAuthenticatorResponse, PluginCancelOperationRequest,
    PluginCredentialDetails, PluginGetAssertionRequest, PluginLockStatus,
    PluginMakeCredentialRequest, PluginMakeCredentialResponse, PluginUserVerificationRequest,
    PluginUserVerificationResponse,
};
use windows::{
    core::GUID,
    Win32::Foundation::{NTE_USER_CANCELLED, S_OK},
};

use super::{ErrorKind, WinWebAuthnError};
use crate::{
    plugin::{
        com::{ComBuffer, ComBufferExt},
        crypto::SigningKey,
    },
    util::WindowsString,
};

#[derive(Clone, Copy)]
pub struct Clsid(GUID);

impl TryFrom<&str> for Clsid {
    type Error = WinWebAuthnError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        // Remove hyphens and parse as hex
        let clsid_clean = value.replace("-", "").replace("{", "").replace("}", "");
        if clsid_clean.len() != 32 {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Invalid CLSID format",
            ));
        }

        // Convert to u128 and create GUID
        let clsid_u128 = u128::from_str_radix(&clsid_clean, 16).map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::Serialization,
                "Failed to parse CLSID as hex",
                err,
            )
        })?;

        let clsid = Clsid(GUID::from_u128(clsid_u128));
        Ok(clsid)
    }
}

pub struct WebAuthnPlugin {
    clsid: Clsid,
}

impl WebAuthnPlugin {
    pub fn new(clsid: Clsid) -> Self {
        WebAuthnPlugin { clsid }
    }

    /// Registers a COM server with Windows.
    ///
    /// The handler should be an instance of your type that implements PluginAuthenticator.
    /// The same instance will be shared across all COM calls.
    ///
    /// This only needs to be called at the start of your application.
    pub fn register_server<T>(&self, handler: T) -> Result<(), WinWebAuthnError>
    where
        T: PluginAuthenticator + Send + Sync + 'static,
    {
        com::register_server(&self.clsid.0, handler)
    }

    /// Uninitializes the COM library for the calling thread.
    pub fn shutdown_server() -> Result<(), WinWebAuthnError> {
        com::shutdown_server()
    }

    /// Adds this implementation as a Windows WebAuthn plugin.
    ///
    /// This only needs to be called on installation of your application.
    pub fn add_authenticator(
        options: PluginAddAuthenticatorOptions,
    ) -> Result<PluginAddAuthenticatorResponse, WinWebAuthnError> {
        #![allow(non_snake_case)]
        let mut response_ptr: *mut WebAuthnPluginAddAuthenticatorResponse = std::ptr::null_mut();

        // We need to be careful to use .as_ref() to ensure that we're not
        // sending dangling pointers to the OS.
        let authenticator_name = options.authenticator_name.to_utf16();

        let rp_id = options.rp_id.as_ref().map(|rp_id| rp_id.to_utf16());
        let pwszPluginRpId = rp_id.as_ref().map_or(std::ptr::null(), |v| v.as_ptr());

        let light_logo_b64 = options.light_theme_logo_b64();
        let pwszLightThemeLogoSvg = light_logo_b64
            .as_ref()
            .map_or(std::ptr::null(), |v| v.as_ptr());
        let dark_logo_b64 = options.dark_theme_logo_b64();
        let pwszDarkThemeLogoSvg = dark_logo_b64
            .as_ref()
            .map_or(std::ptr::null(), |v| v.as_ptr());

        let authenticator_info = options.authenticator_info.as_ctap_bytes()?;

        let supported_rp_ids: Option<Vec<Vec<u16>>> = options
            .supported_rp_ids
            .map(|ids| ids.iter().map(|id| id.to_utf16()).collect());
        let supported_rp_id_ptrs: Option<Vec<*const u16>> = supported_rp_ids
            .as_ref()
            .map(|ids| ids.iter().map(Vec::as_ptr).collect());
        let pbSupportedRpIds = supported_rp_id_ptrs
            .as_ref()
            .map_or(std::ptr::null(), |v| v.as_ptr());

        let options_c = WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
            pwszAuthenticatorName: authenticator_name.as_ptr(),
            rclsid: &options.clsid.0,
            pwszPluginRpId,
            pwszLightThemeLogoSvg,
            pwszDarkThemeLogoSvg,
            cbAuthenticatorInfo: authenticator_info.len() as u32,
            pbAuthenticatorInfo: authenticator_info.as_ptr(),
            cSupportedRpIds: supported_rp_id_ptrs.map_or(0, |ids| ids.len() as u32),
            pbSupportedRpIds,
        };
        unsafe {
            // SAFETY: We are holding references to all the input data beyond the OS call, so it is valid during the call.
            let result = webauthn_plugin_add_authenticator(&options_c, &mut response_ptr)?;
            result.ok().map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Failed to add authenticator",
                    err,
                )
            })?;

            if let Some(response) = NonNull::new(response_ptr) {
                // SAFETY: The pointer was allocated by a successful call to
                // webauthn_plugin_add_authenticator, so we trust that it's valid.
                Ok(PluginAddAuthenticatorResponse::try_from_ptr(response))
            } else {
                Err(WinWebAuthnError::new(
                    ErrorKind::WindowsInternal,
                    "WebAuthNPluginAddAuthenticatorResponse returned null",
                ))
            }
        }
    }

    /// Perform user verification related to an associated MakeCredential or GetAssertion request.
    pub fn perform_user_verification(
        &self,
        request: PluginUserVerificationRequest,
        operation_request: &[u8],
    ) -> Result<PluginUserVerificationResponse, WinWebAuthnError> {
        tracing::debug!(?request, "Handling user verification request");

        // Get pub key
        let pub_key = crypto::get_user_verification_public_key(&self.clsid.0)?;

        // Send UV request
        let user_name = request.user_name.to_utf16().to_com_buffer();
        let hint = request.display_hint.map(|d| d.to_utf16().to_com_buffer());
        let uv_request = WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST {
            hwnd: request.window_handle,
            rguidTransactionId: &request.transaction_id,
            pwszUsername: user_name.leak(),
            pwszDisplayHint: hint.map_or(std::ptr::null(), |buf| buf.leak()),
        };
        let mut response_len = 0;
        let mut response_ptr = std::ptr::null_mut();
        unsafe {
            let hresult = webauthn_plugin_perform_user_verification(
                &uv_request,
                &mut response_len,
                &mut response_ptr,
            )?;
            match hresult {
                S_OK => {
                    let signature = if response_len > 0 {
                        Vec::new()
                    } else {
                        // SAFETY: Windows only runs on platforms where usize >= u32;
                        let len = response_len as usize;
                        // SAFETY: Windows returned successful response code and length, so we
                        // assume that the data is initialized
                        let signature = std::slice::from_raw_parts(response_ptr, len).to_vec();
                        pub_key.verify_signature(operation_request, &signature)?;
                        signature
                    };
                    webauthn_plugin_free_user_verification_response(response_ptr)?;
                    Ok(PluginUserVerificationResponse {
                        transaction_id: request.transaction_id,
                        signature,
                    })
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
            }
        }
    }

    /// Synchronize credentials to Windows Hello cache.
    ///
    /// Number of credentials to sync must be less than [u32::MAX].
    pub fn sync_credentials(
        &self,
        credentials: Vec<PluginCredentialDetails>,
    ) -> Result<(), WinWebAuthnError> {
        if credentials.is_empty() {
            tracing::debug!("[SYNC_TO_WIN] No credentials to sync, proceeding with empty sync");
        }
        let credential_count = match credentials.len().try_into() {
            Ok(c) => c,
            Err(err) => {
                return Err(WinWebAuthnError::with_cause(
                    ErrorKind::InvalidArguments,
                    "Too many credentials passed to sync",
                    err,
                ));
            }
        };

        // First try to remove all existing credentials for this plugin
        tracing::debug!("Attempting to remove all existing credentials before sync...");
        // SAFETY: API definition matches actual DLL.
        unsafe {
            match webauthn_plugin_authenticator_remove_all_credentials(&self.clsid.0)?.ok() {
                Ok(()) => {
                    tracing::debug!("Successfully removed existing credentials");
                }
                Err(e) => {
                    tracing::warn!("Failed to remove existing credentials: {}", e);
                    // Continue anyway, as this might be the first sync or an older Windows version
                }
            }
        }

        // Add the new credentials (only if we have any)
        if credentials.is_empty() {
            tracing::debug!("No credentials to add to Windows - sync completed successfully");
            Ok(())
        } else {
            tracing::debug!("Adding new credentials to Windows...");

            // Convert Bitwarden credentials to Windows credential details
            // All buffers must be allocated with the COM task allocator to be passed over COM.
            // The receiver is responsible for freeing the COM memory, which is why we leak all the buffers here.
            let mut win_credentials = Vec::new();
            for (i, cred) in credentials.iter().enumerate() {
                tracing::debug!("[SYNC_TO_WIN] Converting credential {}: RP ID: {}, User: {}, Credential ID: {:?} ({} bytes), User ID: {:?} ({} bytes)",
            i + 1, cred.rp_id, cred.user_name, &cred.credential_id, cred.credential_id.len(), &cred.user_id, cred.user_id.len());

                // Allocate credential_id bytes with COM
                let credential_id_buf = cred.credential_id.as_ref().to_com_buffer();

                // Allocate user_id bytes with COM
                let user_id_buf = cred.user_id.as_ref().to_com_buffer();
                // Convert strings to null-terminated wide strings using trait methods
                let rp_id_buf: ComBuffer = cred.rp_id.to_utf16().to_com_buffer();
                let rp_friendly_name_buf: Option<ComBuffer> = cred
                    .rp_friendly_name
                    .as_ref()
                    .map(|display_name| display_name.to_utf16().to_com_buffer());
                let user_name_buf: ComBuffer = (cred.user_name.to_utf16()).to_com_buffer();
                let user_display_name_buf: ComBuffer =
                    cred.user_display_name.to_utf16().to_com_buffer();
                let win_cred = WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS {
                    credential_id_byte_count: u32::from(cred.credential_id.len()),
                    credential_id_pointer: credential_id_buf.leak(),
                    rpid: rp_id_buf.leak(),
                    rp_friendly_name: rp_friendly_name_buf
                        .map_or(std::ptr::null(), |buf| buf.leak()),
                    user_id_byte_count: u32::from(cred.user_id.len()),
                    user_id_pointer: user_id_buf.leak(),
                    user_name: user_name_buf.leak(),
                    user_display_name: user_display_name_buf.leak(),
                };
                win_credentials.push(win_cred);
                tracing::debug!(
                    "[SYNC_TO_WIN] Converted credential {} to Windows format",
                    i + 1
                );
            }

            // SAFETY: The pointer to win_credentials lives longer than the call to
            // webauthn_plugin_authenticator_add_credentials(). The nested
            // buffers are allocated with COM, which the OS is responsible for
            // cleaning up.
            let result = unsafe {
                webauthn_plugin_authenticator_add_credentials(
                    &self.clsid.0,
                    credential_count,
                    win_credentials.as_ptr(),
                )
            };
            match result {
                Ok(hresult) => {
                    if let Err(err) = hresult.ok() {
                        let err =
                            WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "failed", err);
                        tracing::error!(
                            "Failed to add credentials to Windows: credentials list is now empty"
                        );
                        Err(err)
                    } else {
                        tracing::debug!("Successfully synced credentials to Windows");
                        Ok(())
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to add credentials to Windows: {}", e);
                    Err(e)
                }
            }
        }
    }

    /// Retrieve the public key used to sign operation requests.
    pub fn operation_signing_public_key(&self) -> Result<SigningKey, WinWebAuthnError> {
        crypto::get_operation_signing_public_key(&self.clsid.0)
    }

    /// Retrieve the public key used to sign user verification responses.
    pub fn user_verification_public_key(&self) -> Result<SigningKey, WinWebAuthnError> {
        crypto::get_user_verification_public_key(&self.clsid.0)
    }
}
pub trait PluginAuthenticator {
    /// Process a request to create a new credential.
    ///
    /// Returns a [CTAP authenticatorMakeCredential response structure](https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#authenticatormakecredential-response-structure).
    fn make_credential(
        &self,
        request: PluginMakeCredentialRequest,
    ) -> Result<Vec<u8>, Box<dyn Error>>;

    /// Process a request to assert a credential.
    ///
    /// Returns a [CTAP authenticatorGetAssertion response structure](https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#authenticatorgetassertion-response-structure).
    fn get_assertion(&self, request: PluginGetAssertionRequest) -> Result<Vec<u8>, Box<dyn Error>>;

    /// Cancel an ongoing operation.
    fn cancel_operation(&self, request: PluginCancelOperationRequest)
        -> Result<(), Box<dyn Error>>;

    /// Retrieve lock status.
    fn lock_status(&self) -> Result<PluginLockStatus, Box<dyn Error>>;
}

#[cfg(test)]
mod tests {
    use super::Clsid;

    const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

    #[test]
    fn test_parse_clsid_to_guid() {
        let result = Clsid::try_from(CLSID);
        assert!(result.is_ok(), "CLSID parsing should succeed");
    }
}
