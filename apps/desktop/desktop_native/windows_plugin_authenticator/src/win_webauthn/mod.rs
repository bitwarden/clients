pub mod plugin;
mod types;
mod util;

use std::{error::Error, fmt::Display};

pub use types::{AuthenticatorInfo, CtapTransport, CtapVersion, PublicKeyCredentialParameters};

use plugin::PluginAuthenticator;
pub use util::HwndExt;

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
pub enum ErrorKind {
    DllLoad,
    Serialization,
    WindowsInternal,
}

impl Display for WinWebAuthnError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let msg = match self.kind {
            ErrorKind::Serialization => "Failed to serialize data",
            ErrorKind::DllLoad => "Failed to load function from DLL",
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
