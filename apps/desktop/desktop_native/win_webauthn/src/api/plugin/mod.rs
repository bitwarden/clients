//! Safe wrappers types and functions around raw webauthn.dll functions defined
//! in `pluginauthenticator.h` and `webauthnplugin.h`.

mod com;
pub(crate) mod crypto;
mod types;

use std::{
    error::Error,
    fmt::{Debug, Display},
    mem::MaybeUninit,
    ptr::NonNull,
};

pub use types::*;
use windows::{
    core::{GUID, PCWSTR},
    Win32::{
        Foundation::{LPARAM, WPARAM},
        Security::Cryptography::BCRYPT_KEY_BLOB,
        System::Com::CLSIDFromString,
        UI::WindowsAndMessaging::{DispatchMessageA, GetMessageA, PostThreadMessageA, WM_QUIT},
    },
};

use crate::{
    api::{
        plugin::{
            com::{register_server, uninitialize_com},
            crypto::{NCryptKey, RequestHash, Signature},
        },
        sys::plugin::webauthn_plugin_free_public_key_response,
        WindowsString,
    },
    ErrorKind, WinWebAuthnError,
};

pub type PluginLockStatus = super::sys::plugin::PLUGIN_LOCK_STATUS;

#[derive(Clone, Copy, Debug)]
pub struct Clsid(GUID);

impl Clsid {
    pub(crate) fn as_guid(&self) -> GUID {
        self.0
    }
}

impl TryFrom<&str> for Clsid {
    type Error = WinWebAuthnError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let wstr = value.to_utf16();
        let clsid = unsafe { CLSIDFromString(PCWSTR::from_raw(wstr.as_ptr())) }.map_err(|err| {
            WinWebAuthnError::with_cause(ErrorKind::InvalidArguments, "Failed to parse CLSID", err)
        })?;
        Ok(Clsid(clsid))
    }
}

impl Display for Clsid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

// Plugin Authenticator types

// Windows API function signatures for decoding get assertion requests
/// Methods needed to implement a Windows passkey plugin authenticator.
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
    ///
    /// `request_hash` refers the hash of the original credential operation
    /// request that is being cancelled, not the hash of the cancel operation
    /// request.
    fn cancel_operation(&self, request: PluginCancelOperationRequest)
        -> Result<(), Box<dyn Error>>;

    /// Retrieve lock status.
    fn lock_status(&self) -> Result<PluginLockStatus, Box<dyn Error>>;
}

/// Public key for verifying a signature over an operation request or user verification response
/// buffer retrieved via [webauthn_plugin_get_operation_signing_public_key] or
/// [webauthn_plugin_get_user_verification_public_key], respectively.
///
/// This is a wrapper for a key blob structure, which starts with a generic
/// [BCRYPT_KEY_BLOB] header that determines what type of key this contains. Key
/// data follows in the remaining bytes specified by `cbPublicKey`.
///
/// The data will be cleaned up with [webauthn_plugin_free_public_key_response]
pub(crate) struct VerifyingKey {
    /// Pointer to a [BCRYPT_KEY_BLOB] header and remaining data.
    key_blob: NonNull<BCRYPT_KEY_BLOB>,
    /// Handle to be used in the Windows BCrypt API.
    key_handle: NCryptKey,
}

impl VerifyingKey {
    /// # Arguments
    /// - `key_blob`: Pointer to the key blob header and remaining data.
    /// - `len`: Total length of the key blob, including the [BCRYPT_KEY_BLOB] header.
    ///
    /// # Safety
    /// The caller must ensure that `key_blob` points to a valid key of length `len`.
    unsafe fn new(
        key_blob: NonNull<BCRYPT_KEY_BLOB>,
        len: usize,
    ) -> Result<Self, WinWebAuthnError> {
        let slice = unsafe { std::slice::from_raw_parts(key_blob.as_ptr().cast(), len) };
        let public_key = crypto::parse_public_key(slice).map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Could not parse public key",
                err,
            )
        })?;
        Ok(Self {
            key_blob,
            key_handle: public_key,
        })
    }

    /// Verifies a signature over a request hash with the associated public key.
    pub(crate) fn verify_signature(
        &self,
        hash: RequestHash,
        signature: Signature,
    ) -> Result<(), WinWebAuthnError> {
        crypto::verify_signature(&self.key_handle, hash, signature).map_err(|err| {
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
            _ = webauthn_plugin_free_public_key_response(self.key_blob.as_mut());
        }
    }
}

/// Object referring to a specific passkey plugin authenticator instance,
/// identified by its CLSID.
///
/// ```no_run
/// use std::collections::HashSet;
///
/// use win_webauthn::{
///     AuthenticatorInfo,
///     CtapVersion,
///     PublicKeyCredentialParameters,
///     Uuid,
///     plugin::{
///         Clsid, PluginAddAuthenticatorOptions, PluginAuthenticator, PluginCancelOperationRequest,
///         PluginGetAssertionRequest, PluginLockStatus, PluginMakeCredentialRequest, WebAuthnPlugin,
///     },
/// };
///
/// struct MyAuthenticator { }
///
/// impl PluginAuthenticator for MyAuthenticator {
///     fn make_credential(
///         &self,
///         request: PluginMakeCredentialRequest,
///     ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
///         let response = vec![ /* CTAP2 makeCredential response */];
///         Ok(response)
///     }
///
///     fn get_assertion(&self, request: PluginGetAssertionRequest) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
///         let response = vec![ /* CTAP2 getAssertion response */];
///         Ok(response)
///     }
///
///     fn cancel_operation(&self, request: PluginCancelOperationRequest)
///         -> Result<(), Box<dyn std::error::Error>> {
///         Ok(())
///     }
///
///     fn lock_status(&self) -> Result<PluginLockStatus, Box<dyn std::error::Error>> {
///         Ok(PluginLockStatus::PluginUnlocked)
///     }
/// }
///
/// let clsid = Clsid::try_from("{51739952-ca07-4071-99bb-187481f8859e}").unwrap();
/// let aaguid = Uuid::try_from("2ca2470f-fd84-4d7f-a0cd-68e71dd2d159").unwrap();
/// // Add this plugin as an option in Windows settings.
/// let authenticator = MyAuthenticator { };
/// let authenticator_info = AuthenticatorInfo {
///     versions: HashSet::from([CtapVersion::Fido2_0, CtapVersion::Fido2_1]),
///     aaguid,
///     options: Some(HashSet::from([
///         "rk".to_string(),
///         "up".to_string(),
///         "uv".to_string(),
///     ])),
///     transports: Some(HashSet::from([
///         "internal".to_string(),
///         "hybrid".to_string(),
///     ])),
///     algorithms: Some(vec![PublicKeyCredentialParameters {
///         alg: -7,
///         typ: "public-key".to_string(),
///     }]),
/// };
/// let options = PluginAddAuthenticatorOptions {
///     authenticator_name: "My Authenticator".to_string(),
///     clsid,
///     rp_id: Some("example.com".to_string()),
///     light_theme_logo_svg: Some(r#"
///         <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
///           <!-- Minimalist Circle and Letter Logo -->
///           <circle cx="50" cy="50" r="40" stroke="black" stroke-width="4" fill="none" />
///           <text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="40" font-weight="bold" fill="black" dy=".3em">M</text>
///         </svg>
///     "#.to_string()),
///     dark_theme_logo_svg: None,
///     authenticator_info,
///     supported_rp_ids: None,
/// };
/// WebAuthnPlugin::add_authenticator(&options).unwrap();
///
/// // Register this process to receive COM messages.
/// let mut plugin = WebAuthnPlugin::new(clsid);
/// plugin.register_server(authenticator).unwrap();
/// ```
pub struct WebAuthnPlugin {
    clsid: Clsid,
    com_thread_id: Option<u32>,
}

impl WebAuthnPlugin {
    pub fn new(clsid: Clsid) -> Self {
        WebAuthnPlugin {
            clsid,
            com_thread_id: None,
        }
    }

    /// Registers a COM server with Windows and starts the COM message loop on a dedicated thread.
    ///
    /// The handler should be an instance of your type that implements [PluginAuthenticator].
    /// The same instance will be shared across all COM calls.
    ///
    /// Blocks until the COM server is initialized, then returns. The COM thread continues running
    /// in the background until [shutdown_server] is called.
    pub fn register_server<T>(&mut self, handler: T) -> Result<(), WinWebAuthnError>
    where
        T: PluginAuthenticator + Send + Sync + 'static,
    {
        let clsid = self.clsid;
        let (tx, rx) = std::sync::mpsc::channel::<Result<u32, windows::core::Error>>();

        std::thread::spawn(move || {
            match register_server(clsid, handler) {
                Err(err) => {
                    tx.send(Err(err)).ok();
                }
                Ok(com_thread_id) => {
                    let span = tracing::info_span!("plugin_com_thread", thread_id = com_thread_id);
                    let _span_guard = span.enter();
                    tracing::debug!("Initialized COM server.");
                    tx.send(Ok(com_thread_id)).ok();
                    // Run the COM message loop until WM_QUIT is posted.
                    loop {
                        let mut msg = MaybeUninit::uninit();
                        match unsafe { GetMessageA(msg.as_mut_ptr(), None, 0, 0).0 } {
                            // WM_QUIT was sent, exit the loop
                            0 => break,
                            -1 => {
                                tracing::error!(
                                    "GetMessageA failed in plugin authenticator COM server event loop: {}",
                                    windows::core::Error::from_thread()
                                );
                                break;
                            }
                            // A message was received, forward it to the appropriate
                            _ => unsafe {
                                let msg = msg.assume_init_ref();
                                DispatchMessageA(msg);
                            },
                        }
                    }
                    uninitialize_com();
                }
            }
        });

        let result = rx
            .recv()
            .map(|result| {
                result.map_err(|com_err| {
                    WinWebAuthnError::with_cause(
                        ErrorKind::WindowsInternal,
                        "Failed to register COM server",
                        com_err,
                    )
                })
            })
            .unwrap_or_else(|_| {
                Err(WinWebAuthnError::new(
                    ErrorKind::Other,
                    "COM thread disconnected before initialization completed",
                ))
            });

        let com_thread_id = result?;
        self.com_thread_id = Some(com_thread_id);
        Ok(())
    }

    /// Stops the COM message loop and uninitializes COM on the COM thread.
    pub fn shutdown_server(&mut self) -> Result<(), WinWebAuthnError> {
        if let Some(thread_id) = self.com_thread_id.take() {
            unsafe { PostThreadMessageA(thread_id, WM_QUIT, WPARAM(0), LPARAM(0)) }.map_err(
                |err| {
                    WinWebAuthnError::with_cause(
                        ErrorKind::WindowsInternal,
                        "Failed to post quit message to COM thread",
                        err,
                    )
                },
            )?;
        }
        Ok(())
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
        request_hash: &[u8],
    ) -> Result<(), WinWebAuthnError> {
        tracing::debug!(?request.transaction_id, ?request.window_handle, "Handling user verification request");

        // Get pub key
        let pub_key = get_user_verification_public_key(self.clsid)?;

        // Send UV request
        let request_raw: PluginUserVerificationRequestRaw = (&request).into();
        perform_user_verification(&request_raw, &pub_key, request_hash)
    }

    /// Synchronize credentials to Windows Hello cache.
    ///
    /// Number of credentials to sync must be less than [u32::MAX].
    pub fn sync_credentials(
        &self,
        credentials: Vec<PluginCredentialDetails>,
    ) -> Result<(), WinWebAuthnError> {
        if let Err(err) = u32::try_from(credentials.len()) {
            return Err(WinWebAuthnError::with_cause(
                ErrorKind::InvalidArguments,
                "Too many credentials passed to sync",
                err,
            ));
        };

        // First try to remove all existing credentials for this plugin
        tracing::debug!("Attempting to remove all existing credentials before sync...");
        match remove_all_credentials(self.clsid) {
            Ok(()) => {
                tracing::debug!("Successfully removed existing credentials");
            }
            Err(e) => {
                tracing::warn!("Failed to remove existing credentials: {}", e);
                // Continue anyway, as this might be the first sync or an older Windows version
            }
        };

        // Add the new credentials (only if we have any)
        if credentials.is_empty() {
            tracing::debug!("No credentials to add to Windows - sync completed successfully");
            return Ok(());
        }
        tracing::debug!("Adding new credentials to Windows...");

        // Convert to raw credentials to Windows credential details
        let win_credentials = credentials
            .iter()
            .map(PluginCredentialDetailsRaw::from)
            .collect::<Vec<_>>();

        let result = add_credentials(&self.clsid, win_credentials);

        match result {
            Err(err) => Err(WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to add credentials to Windows autofill list. Credentials list is now empty",
                err,
            )),
            Ok(()) => {
                tracing::debug!("Successfully synced credentials to Windows");
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Clsid;

    const CLSID: &str = "{0f7dc5d9-69ce-4652-8572-6877fd695062}";

    #[test]
    fn test_parse_clsid_to_guid() {
        let result = Clsid::try_from(CLSID);
        assert!(result.is_ok(), "CLSID parsing should succeed");
    }
}
