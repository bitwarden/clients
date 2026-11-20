//! A Rust wrapper around the webauthn.dll API.
//!
//! The root module contains common types for WebAuthn clients and plugins.
//!
//! The [plugin] module has types useful for implementing a Windows passkey
//! plugin authenticator.
#![cfg(target_os = "windows")]
// TODO: Temporarily allow unused code while scaffolding. Remove once PR set is finished.
#![expect(unused)]

#[allow(unsafe_code)]
pub(crate) mod api;
#[forbid(unsafe_code)]
pub mod plugin;

use std::{error::Error, fmt::Display};

pub use api::{
    webauthn::{
        api_version, get_assertion, AllowCredential, Assertion, AuthenticatorAttachment,
        AuthenticatorInfo, CancellationId, CredentialId, CtapTransport, CtapVersion,
        GetAssertionRequest, GetAssertionRequestBuilder, PrfInputs, PrfOutputs, PrfValues,
        PublicKeyCredentialParameters, UserId, UserVerificationRequirement, Uuid,
    },
    CborError, CborParser, CborValue, CborWriter,
};

/// Errors that may be returned when interacting with this library.
#[derive(Debug)]
pub struct WinWebAuthnError {
    kind: ErrorKind,
    description: Option<String>,
    cause: Option<Box<dyn std::error::Error + Send + Sync>>,
    dom_error_name: Option<String>,
}

impl WinWebAuthnError {
    pub(crate) fn new(kind: ErrorKind, description: &str) -> Self {
        Self {
            kind,
            description: Some(description.to_string()),
            cause: None,
            dom_error_name: None,
        }
    }

    pub(crate) fn with_cause<E: std::error::Error + Send + Sync + 'static>(
        kind: ErrorKind,
        description: &str,
        cause: E,
    ) -> Self {
        let cause: Box<dyn std::error::Error + Send + Sync> = Box::new(cause);
        Self {
            kind,
            description: Some(description.to_string()),
            cause: Some(cause),
            dom_error_name: None,
        }
    }

    pub(crate) fn with_dom_error_name(mut self, name: Option<String>) -> Self {
        self.dom_error_name = name;
        self
    }

    /// Whether the user dismissed an OS prompt, as opposed to the operation
    /// failing. Callers generally want to report this as an outcome rather than
    /// an error.
    pub fn is_user_cancelled(&self) -> bool {
        matches!(self.kind, ErrorKind::UserCancelled)
    }

    /// The name of the W3C `DOMException` that corresponds to this error, e.g.
    /// `"NotAllowedError"`, if the error was returned by a WebAuthn operation.
    pub fn dom_error_name(&self) -> Option<&str> {
        self.dom_error_name.as_deref()
    }
}

#[derive(Debug)]
enum ErrorKind {
    /// There was an error loading the webauthn.dll library.
    DllLoad,

    /// There was an error parsing or serializing data.
    Serialization,

    /// An invalid argument was passed.
    InvalidArguments,

    /// The feature is not supported by the installed version of webauthn.dll.
    NotSupported,

    /// A WebAuthn operation failed.
    OperationFailed,

    /// An unknown error occurred.
    Other,

    /// The user dismissed an OS prompt.
    UserCancelled,

    /// An internal library error occurred.
    WindowsInternal,
}

impl Display for WinWebAuthnError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let msg = match self.kind {
            ErrorKind::Serialization => "Failed to serialize data",
            ErrorKind::DllLoad => "Failed to load function from DLL",
            ErrorKind::InvalidArguments => "Invalid arguments passed to function",
            ErrorKind::NotSupported => "Not supported by this version of Windows",
            ErrorKind::OperationFailed => "The WebAuthn operation failed",
            ErrorKind::Other => "An error occurred",
            ErrorKind::UserCancelled => "The user cancelled the operation",
            ErrorKind::WindowsInternal => "A Windows error occurred",
        };
        f.write_str(msg)?;
        if let Some(d) = &self.description {
            write!(f, ": {d}")?;
        }
        if let Some(e) = &self.cause {
            write!(f, ". Caused by: {e}")?;
        }
        Ok(())
    }
}

impl Error for WinWebAuthnError {}
