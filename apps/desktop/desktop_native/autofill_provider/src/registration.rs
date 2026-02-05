use std::sync::Arc;

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::{Deserialize, Serialize};

use crate::{BitwardenError, Callback, Position, TimedCallback, UserVerification};

/// Request to create a credential.
#[cfg_attr(feature = "napi", napi(object, namespace = "autofill"))]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationRequest {
    /// Relying Party ID for the request.
    pub rp_id: String,

    /// The user name for the credential that was previously given to the OS.
    pub user_name: String,

    /// The user ID for the credential that was previously given to the OS.
    pub user_handle: Vec<u8>,

    /// SHA-256 hash of the `clientDataJSON` for the registration request.
    pub client_data_hash: Vec<u8>,

    /// User verification preference.
    pub user_verification: UserVerification,

    /// Supported key algorithms in COSE format.
    pub supported_algorithms: Vec<i32>,

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

    /// List of excluded credential IDs.
    pub excluded_credentials: Vec<Vec<u8>>,

    /// Byte string representing the native OS window handle for the WebAuthn client.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Unused.
    ///
    /// ## Windows
    /// On Windows, this is a HWND.
    pub client_window_handle: Option<Vec<u8>>,

    /// Native context required for callbacks to the OS. Format differs by OS.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Unused.
    ///
    /// ## Windows
    /// On Windows, this is a base64-string representing the following data:
    /// `request transaction id (GUID, 16 bytes) || SHA-256(pluginOperationRequest)`
    pub context: Option<String>,
}

/// Response for a passkey registration request.
#[cfg_attr(feature = "napi", napi(object, namespace = "autofill"))]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationResponse {
    /// Relying Party ID.
    pub rp_id: String,

    /// SHA-256 hash of the `clientDataJSON` used in the registration.
    pub client_data_hash: Vec<u8>,

    /// The ID for the created credential.
    pub credential_id: Vec<u8>,

    /// WebAuthn attestation object.
    pub attestation_object: Vec<u8>,
}

/// Callback to process a response to passkey registration request.
#[cfg_attr(feature = "uniffi", uniffi::export(with_foreign))]
pub trait PreparePasskeyRegistrationCallback: Send + Sync {
    /// Function to call if a successful response is returned.
    fn on_complete(&self, credential: PasskeyRegistrationResponse);

    /// Function to call if an error response is returned.
    fn on_error(&self, error: BitwardenError);
}

impl Callback for Arc<dyn PreparePasskeyRegistrationCallback> {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error> {
        let credential = serde_json::from_value(credential)?;
        PreparePasskeyRegistrationCallback::on_complete(self.as_ref(), credential);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        PreparePasskeyRegistrationCallback::on_error(self.as_ref(), error);
    }
}

impl PreparePasskeyRegistrationCallback for TimedCallback<PasskeyRegistrationResponse> {
    fn on_complete(&self, credential: PasskeyRegistrationResponse) {
        self.send(Ok(credential));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error));
    }
}
