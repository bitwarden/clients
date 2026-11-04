//! WebAuthn client operations using the platform's passkey APIs, for signing in to Bitwarden with
//! a passkey.

use std::time::Duration;

use thiserror::Error;

#[cfg_attr(not(any(target_os = "windows", target_os = "macos")), allow(dead_code))]
mod client_data;

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(
    not(any(target_os = "windows", target_os = "macos")),
    path = "unimplemented.rs"
)]
mod platform;

// These are WebAuthn client types, with an origin and a challenge. sdk-internal's
// `bitwarden-fido::types` are mostly authenticator types, with a client data hash instead, so only
// the PRF values overlap.

/// A request for an assertion, corresponding to WebAuthn's
/// [`PublicKeyCredentialRequestOptions`][options].
///
/// [options]: https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptions
pub struct AssertionRequest {
    /// The origin making the request, e.g. `https://vault.bitwarden.com`. On platforms where the
    /// app creates the client data, this is its origin. Platforms that set the origin themselves
    /// ignore it.
    pub origin: String,
    /// The RP ID. It must be the origin's host, or a domain that the host is a subdomain of.
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
    /// The U2F app ID from the `appid` extension, which allows credentials registered with the
    /// U2F API to be used. It must be valid for the origin.
    pub app_id: Option<String>,
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
    /// Whether the U2F app ID was used instead of the RP ID, if one was requested. This is the
    /// `appid` extension output.
    pub app_id_used: Option<bool>,
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

    /// The request was cancelled with a [Cancellation].
    #[error("The WebAuthn request was cancelled")]
    Cancelled,

    /// The platform's passkey APIs can't be used for the request, e.g. because the RP ID is not in
    /// the app's associated domains on macOS. Retry it in a browser with
    /// [web_authentication_session].
    #[error("{0}")]
    RequiresBrowser(String),

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
            Self::Cancelled => "AbortError",
            Self::RequiresBrowser(_) => "NotAllowedError",
            Self::Platform { dom_error_name, .. } => {
                dom_error_name.as_deref().unwrap_or("UnknownError")
            }
        }
    }
}

/// Cancels an in-progress [get_assertion] or [web_authentication_session] call from another
/// thread.
///
/// If this is cancelled before the call starts, the call returns [Error::Cancelled] without
/// showing a prompt. A cancellation in the short window after the call starts, but before the
/// platform has registered the operation, is missed.
#[derive(Clone)]
pub struct Cancellation(platform::Cancellation);

impl Cancellation {
    /// Creates a cancellation for a single [get_assertion] or [web_authentication_session] call.
    pub fn new() -> Result<Self, Error> {
        platform::Cancellation::new().map(Self)
    }

    /// Cancels the call. The platform's prompt or browser is closed, and the call returns
    /// [Error::Cancelled].
    pub fn cancel(&self) {
        self.0.cancel();
    }
}

/// Requests a WebAuthn assertion from the platform's passkey APIs.
///
/// Shows the platform's passkey prompt, modal to `window_handle`, and blocks until the user
/// completes or dismisses it, or until it is cancelled with `cancellation`. Run this on a thread
/// that may block.
///
/// # Arguments
/// - `window_handle`: The native window handle from Electron's `getNativeWindowHandle()`. On macOS
///   this is a pointer to an `NSView`, so it must be the handle of a window that is open.
/// - `request`: The assertion request.
/// - `cancellation`: Can be used to cancel the call from another thread.
pub fn get_assertion(
    window_handle: &[u8],
    request: AssertionRequest,
    cancellation: &Cancellation,
) -> Result<AssertionResponse, Error> {
    platform::get_assertion(window_handle, request, &cancellation.0)
}

/// Whether the platform's passkey APIs can't be used for `rp_id`, so the assertion must be made in
/// a browser with [web_authentication_session] instead of with [get_assertion].
///
/// On macOS, the passkey APIs can only be used for relying parties in the app's associated domains.
pub fn requires_browser(rp_id: &str) -> bool {
    platform::requires_browser(rp_id)
}

/// Opens `url` in a browser session and returns the URL that the page navigates to with the
/// scheme `callback_scheme`, which ends the session. Only this caller receives that URL, rather
/// than the app's URL scheme handler. The session does not share cookies or other browsing data
/// with the user's browser.
///
/// Presents the session from `window_handle`, and blocks until the page completes, the user
/// dismisses it, or it is cancelled with `cancellation`. Run this on a thread that may block.
///
/// Only implemented on macOS, with `ASWebAuthenticationSession`.
///
/// # Arguments
/// - `window_handle`: As for [get_assertion].
/// - `url`: An `https` or `http` URL.
/// - `callback_scheme`: The scheme, without `:`, that ends the session.
/// - `cancellation`: Can be used to cancel the call from another thread.
pub fn web_authentication_session(
    window_handle: &[u8],
    url: &str,
    callback_scheme: &str,
    cancellation: &Cancellation,
) -> Result<String, Error> {
    platform::web_authentication_session(window_handle, url, callback_scheme, &cancellation.0)
}
