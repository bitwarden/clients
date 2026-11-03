//! WebAuthn client operations using the platform's passkey APIs, for signing in to Bitwarden with
//! a passkey.

use std::time::Duration;

use thiserror::Error;

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
mod client_data;

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(not(target_os = "windows"), path = "unimplemented.rs")]
mod platform;

// These are WebAuthn client types, with an origin and a challenge. sdk-internal's
// `bitwarden-fido::types` are mostly authenticator types, with a client data hash instead, so only
// the PRF values overlap.

/// A request for an assertion, corresponding to WebAuthn's
/// [`PublicKeyCredentialRequestOptions`][options].
///
/// [options]: https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptions
pub struct AssertionRequest {
    /// The RP ID. On platforms where the app creates the client data, the origin is
    /// `https://{rp_id}`.
    pub rp_id: String,
    /// The challenge from the RP.
    pub challenge: Vec<u8>,
    /// Credentials that may be used. If empty, any discoverable credential for the RP may be used.
    pub allow_credentials: Vec<CredentialDescriptor>,
    /// Whether the user must be verified.
    pub user_verification: UserVerification,
    /// Guidance for how long to wait for the user. Platforms may ignore it.
    pub timeout: Option<Duration>,
    /// PRF extension `eval` inputs. Platforms that do not support PRF send the request without
    /// them.
    pub prf: Option<PrfValues>,
}

/// Corresponds to WebAuthn's [`PublicKeyCredentialDescriptor`][descriptor].
///
/// [descriptor]: https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialdescriptor
pub struct CredentialDescriptor {
    /// The credential ID.
    pub id: Vec<u8>,
    /// Hints for how to reach the credential. Platforms may ignore them.
    pub transports: Vec<Transport>,
}

/// Corresponds to WebAuthn's [`AuthenticatorTransport`][transport].
///
/// [transport]: https://www.w3.org/TR/webauthn-3/#enum-transport
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(missing_docs)]
pub enum Transport {
    Usb,
    Nfc,
    Ble,
    SmartCard,
    Hybrid,
    Internal,
}

/// Corresponds to WebAuthn's [`UserVerificationRequirement`][uv].
///
/// [uv]: https://www.w3.org/TR/webauthn-3/#enumdef-userverificationrequirement
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
#[allow(missing_docs)]
pub enum UserVerification {
    Required,
    #[default]
    Preferred,
    Discouraged,
}

/// PRF extension inputs or outputs. These are secrets and must not be logged.
pub struct PrfValues {
    /// The first PRF value.
    pub first: Vec<u8>,
    /// The optional second PRF value.
    pub second: Option<Vec<u8>>,
}

/// An assertion, corresponding to the fields of a WebAuthn [`PublicKeyCredential`][credential]
/// with an `AuthenticatorAssertionResponse`.
///
/// [credential]: https://www.w3.org/TR/webauthn-3/#publickeycredential
pub struct AssertionResponse {
    /// The ID of the credential that was used.
    pub credential_id: Vec<u8>,
    /// The client data that was signed.
    pub client_data_json: Vec<u8>,
    /// The authenticator data that was signed.
    pub authenticator_data: Vec<u8>,
    /// The assertion signature.
    pub signature: Vec<u8>,
    /// The user handle of the credential, if the authenticator returned one.
    pub user_handle: Option<Vec<u8>>,
    /// How the authenticator was reached, if the platform reports it.
    pub attachment: Option<Attachment>,
    /// PRF outputs, if PRF was requested and the authenticator returned results.
    pub prf: Option<PrfValues>,
}

/// Corresponds to WebAuthn's [`AuthenticatorAttachment`][attachment].
///
/// [attachment]: https://www.w3.org/TR/webauthn-3/#enumdef-authenticatorattachment
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(missing_docs)]
pub enum Attachment {
    Platform,
    CrossPlatform,
}

/// Errors returned by WebAuthn operations.
#[derive(Debug, Error)]
pub enum Error {
    /// WebAuthn is not implemented on this platform yet.
    #[error("WebAuthn is not implemented on this platform")]
    NotImplemented,

    /// The request is malformed.
    #[error("Invalid WebAuthn request: {0}")]
    InvalidRequest(String),

    /// The platform rejected or failed the operation, including when the user cancels it.
    #[error("{message}")]
    Platform {
        /// A description of the failure.
        message: String,
        /// The name of the corresponding `DOMException`, if the platform reported one.
        dom_error_name: Option<String>,
    },
}

impl Error {
    /// The name of the `DOMException` that `navigator.credentials.get()` would throw for this
    /// error.
    pub fn dom_error_name(&self) -> &str {
        match self {
            Self::NotImplemented => "NotSupportedError",
            Self::InvalidRequest(_) => "SyntaxError",
            Self::Platform { dom_error_name, .. } => {
                dom_error_name.as_deref().unwrap_or("UnknownError")
            }
        }
    }
}

/// Requests a WebAuthn assertion from the platform's passkey APIs.
///
/// Shows the platform's passkey prompt, modal to `window_handle`, and blocks until the user
/// completes or dismisses it. Run this on a thread that may block.
///
/// # Arguments
/// - `window_handle`: The native window handle from Electron's `getNativeWindowHandle()`.
/// - `request`: The assertion request.
pub fn get_assertion(
    window_handle: &[u8],
    request: AssertionRequest,
) -> Result<AssertionResponse, Error> {
    platform::get_assertion(window_handle, request)
}
