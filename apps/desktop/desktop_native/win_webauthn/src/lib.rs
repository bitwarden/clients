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

pub use api::webauthn::{
    AuthenticatorInfo, CredentialId, CtapTransport, CtapVersion, PublicKeyCredentialParameters,
    UserId, Uuid,
};

/// Errors that may be returned when interacting with this library.
#[derive(Debug)]
pub struct WinWebAuthnError {
    kind: ErrorKind,
    description: Option<String>,
    cause: Option<Box<dyn std::error::Error>>,
}

impl WinWebAuthnError {
    pub(crate) fn new(kind: ErrorKind, description: &str) -> Self {
        Self {
            kind,
            description: Some(description.to_string()),
            cause: None,
        }
    }

    pub(crate) fn with_cause<E: std::error::Error + 'static>(
        kind: ErrorKind,
        description: &str,
        cause: E,
    ) -> Self {
        let cause: Box<dyn std::error::Error> = Box::new(cause);
        Self {
            kind,
            description: Some(description.to_string()),
            cause: Some(cause),
        }
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

    /// An unknown error occurred.
    Other,

    /// An internal library error occurred.
    WindowsInternal,
}

impl Display for WinWebAuthnError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let msg = match self.kind {
            ErrorKind::Serialization => "Failed to serialize data",
            ErrorKind::DllLoad => "Failed to load function from DLL",
            ErrorKind::InvalidArguments => "Invalid arguments passed to function",
            ErrorKind::Other => "An error occurred",
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
