use std::{error::Error, mem::MaybeUninit, ptr::NonNull};

use windows::{
    core::GUID,
    Win32::Foundation::{NTE_USER_CANCELLED, S_OK},
};

pub use crate::api::plugin::{
    Clsid, PluginAddAuthenticatorOptions, PluginAddAuthenticatorResponse,
    PluginCancelOperationRequest, PluginCredentialDetails, PluginGetAssertionRequest,
    PluginLockStatus, PluginMakeCredentialRequest, PluginMakeCredentialResponse,
    PluginUserVerificationRequest, PluginUserVerificationResponse,
};

use crate::{
    api::{
        plugin::{add_credentials, register_server},
        sys::{
            crypto::{self, RequestHash, Signature},
            plugin::{
                webauthn_plugin_add_authenticator, webauthn_plugin_authenticator_add_credentials,
                webauthn_plugin_authenticator_remove_all_credentials,
                webauthn_plugin_free_user_verification_response,
                webauthn_plugin_perform_user_verification,
                WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
                WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE, WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS,
                WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST,
            },
        },
    },
    plugin::types::{add_authenticator, PluginAddAuthenticatorOptionsRaw},
};

use crate::{api::WindowsString, ErrorKind, WinWebAuthnError};

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
        register_server(self.clsid, handler)
    }

    /// Uninitializes the COM library for the calling thread.
    pub fn shutdown_server() -> Result<(), WinWebAuthnError> {
        com::shutdown_server()
    }

    /// Adds this implementation as a Windows WebAuthn plugin.
    ///
    /// This only needs to be called on installation of your application.
    pub fn add_authenticator(
        options: &PluginAddAuthenticatorOptions,
    ) -> Result<PluginAddAuthenticatorResponse, WinWebAuthnError> {
        let options_raw = options.try_into()?;
        add_authenticator(&options_raw)
    }

    /// Perform user verification related to an associated MakeCredential or GetAssertion request.
    ///
    /// # Arguments
    /// - `request`: UI and transaction context for the user verification prompt.
    /// - `operation_request_hash`: The SHA-256 hash of the original operation request buffer
    ///   related to this user verification request.
    pub fn perform_user_verification(
        &self,
        request: PluginUserVerificationRequest,
        operation_request_hash: &[u8],
    ) -> Result<PluginUserVerificationResponse, WinWebAuthnError> {
        tracing::debug!(?request.transaction_id, ?request.window_handle, "Handling user verification request");

        // Get pub key
        let pub_key = crypto::get_user_verification_public_key(&self.clsid.0)?;

        // Send UV request
        let user_name = request.user_name.to_utf16().to_com_buffer();
        let hint = request.display_hint.map(|d| d.to_utf16().to_com_buffer());
        let uv_request = WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST {
            hwnd: request.window_handle,
            rguidTransactionId: &request.transaction_id,
            pwszUsername: user_name.into_raw(),
            pwszDisplayHint: hint.map_or(std::ptr::null(), |buf| buf.into_raw()),
        };
        let mut response_len = 0;
        let mut response_ptr = MaybeUninit::uninit();
        let hresult = unsafe {
            webauthn_plugin_perform_user_verification(
                &uv_request,
                &mut response_len,
                response_ptr.as_mut_ptr(),
            )?
        };
        match hresult {
            S_OK => {
                // SAFETY: Windows returned successful response code and length, so we
                // assume that the data and length are initialized
                let response_ptr = unsafe { response_ptr.assume_init() };
                let signature = unsafe {
                    // SAFETY: Windows only runs on platforms where usize >= u32;
                    let len = response_len as usize;
                    std::slice::from_raw_parts(response_ptr, len).to_vec()
                };
                pub_key.verify_signature(
                    RequestHash::new(operation_request_hash),
                    Signature::new(&signature),
                )?;
                unsafe {
                    webauthn_plugin_free_user_verification_response(response_ptr)?;
                }
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
            let mut win_credentials = Vec::new();
            for (i, cred) in credentials.iter().enumerate() {
                tracing::debug!(
                    "[SYNC_TO_WIN] Converting credential {}: RP ID: {}, Credential ID: {:?} ({} bytes), User ID: **** ({} bytes)",
                    i + 1,
                    cred.rp_id,
                    &cred.credential_id,
                    cred.credential_id.len(),
                    cred.user_id.len()
                );
                win_credentials.push(cred.into());
                tracing::debug!(
                    "[SYNC_TO_WIN] Converted credential {} to Windows format",
                    i + 1
                );
            }

            let result = add_credentials(&self.clsid, win_credentials.as_slice());
            match result {
                Ok(hresult) => {
                    if let Err(err) = hresult.ok() {
                        let err = WinWebAuthnError::with_cause(
                            ErrorKind::WindowsInternal,
                            "Failed to add credentials to Windows autofill list. Credentials list is now empty",
                            err,
                        );
                        tracing::error!(
                            "Failed to add credentials to Windows autofill list. Credentials list is now empty"
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
