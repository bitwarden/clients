use std::sync::Arc;

use serde::{Deserialize, Serialize};

#[cfg(not(target_os = "macos"))]
use crate::TimedCallback;
use crate::{BitwardenError, Callback, Position, UserVerification};

/// Request to assert a credential.
#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionRequest {
    /// Relying Party ID for the request.
    pub rp_id: String,

    /// SHA-256 hash of the `clientDataJSON` for the assertion request.
    pub client_data_hash: Vec<u8>,

    /// User verification preference.
    pub user_verification: UserVerification,

    /// List of allowed credential IDs.
    pub allowed_credentials: Vec<Vec<u8>>,

    /// Coordinates of the center of the WebAuthn client's window, relative to
    /// the top-left point on the screen.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Note that macOS APIs gives points relative to the bottom-left point on the
    /// screen by default, so the y-coordinate will be flipped.
    ///
    /// ## Windows
    /// On Windows, this must be logical pixels, not physical pixels.
    pub window_xy: Position,

    /// Byte string representing the native OS window handle for the WebAuthn client.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Unused.
    ///
    /// ## Windows
    /// On Windows, this is a HWND.
    #[cfg(not(target_os = "macos"))]
    pub client_window_handle: Vec<u8>,

    /// Native context required for callbacks to the OS. Format differs on the OS.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Unused.
    ///
    /// ## Windows
    /// On Windows, this is a base64-string representing the following data:
    /// `request transaction id (GUID, 16 bytes) || SHA-256(pluginOperationRequest)`
    #[cfg(not(target_os = "macos"))]
    pub context: String,
    //  TODO(PM-30510): Implement support for extensions
    // pub extension_input: Vec<u8>,
}

/// Request to assert a credential without user interaction.
#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionWithoutUserInterfaceRequest {
    /// Relying Party ID.
    pub rp_id: String,

    /// The allowed credential ID for the request.
    pub credential_id: Vec<u8>,

    /// The user name for the credential that was previously given to the OS.
    #[cfg(target_os = "macos")]
    pub user_name: String,

    /// The user ID for the credential that was previously given to the OS.
    #[cfg(target_os = "macos")]
    pub user_handle: Vec<u8>,

    /// The app-specific local identifier for the credential, in our case, the
    /// cipher ID.
    #[cfg(target_os = "macos")]
    pub record_identifier: Option<String>,

    /// SHA-256 hash of the `clientDataJSON` for the assertion request.
    pub client_data_hash: Vec<u8>,

    /// User verification preference.
    pub user_verification: UserVerification,

    /// Coordinates of the center of the WebAuthn client's window, relative to
    /// the top-left point on the screen.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Note that macOS APIs gives points relative to the bottom-left point on the
    /// screen by default, so the y-coordinate will be flipped.
    ///
    /// ## Windows
    /// On Windows, this must be logical pixels, not physical pixels.
    pub window_xy: Position,

    /// Byte string representing the native OS window handle for the WebAuthn client.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Unused.
    ///
    /// ## Windows
    /// On Windows, this is a HWND.
    #[cfg(not(target_os = "macos"))]
    pub client_window_handle: Vec<u8>,

    /// Native context required for callbacks to the OS. Format differs on the OS.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Unused.
    ///
    /// ## Windows
    /// On Windows, this is `request transaction id () || SHA-256(pluginOperationRequest)`.
    #[cfg(not(target_os = "macos"))]
    pub context: String,
}

/// Response for a passkey assertion request.
#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionResponse {
    /// Relying Party ID.
    pub rp_id: String,

    /// The user ID for the credential that was previously given to the OS.
    pub user_handle: Vec<u8>,

    /// The signature for the WebAuthn attestation response.
    pub signature: Vec<u8>,

    /// SHA-256 hash of the `clientDataJSON` used in the assertion.
    pub client_data_hash: Vec<u8>,

    /// The WebAuthn authenticator data structure.
    pub authenticator_data: Vec<u8>,

    /// The ID for the attested credential.
    pub credential_id: Vec<u8>,
}

/// Callback to process a response to passkey assertion request.
#[cfg_attr(target_os = "macos", uniffi::export(with_foreign))]
pub trait PreparePasskeyAssertionCallback: Send + Sync {
    /// Function to call if a successful response is returned.
    fn on_complete(&self, credential: PasskeyAssertionResponse);

    /// Function to call if an error response is returned.
    fn on_error(&self, error: BitwardenError);
}

impl Callback for Arc<dyn PreparePasskeyAssertionCallback> {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error> {
        let credential = serde_json::from_value(credential)?;
        PreparePasskeyAssertionCallback::on_complete(self.as_ref(), credential);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        PreparePasskeyAssertionCallback::on_error(self.as_ref(), error);
    }
}

#[cfg(not(target_os = "macos"))]
impl PreparePasskeyAssertionCallback for TimedCallback<PasskeyAssertionResponse> {
    fn on_complete(&self, credential: PasskeyAssertionResponse) {
        self.send(Ok(credential));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error));
    }
}
