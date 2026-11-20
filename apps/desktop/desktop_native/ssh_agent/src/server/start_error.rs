//! Structured errors for starting the SSH agent server.
//!
//! The error text is shown to (and mapped by) the Electron layer, so it must never contain a
//! socket path, pipe name, user name or key material. Only static descriptions and the
//! underlying OS error (which carries no path) are kept.

use std::{fmt, io};

/// Coarse classification of why the agent server could not start.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StartErrorKind {
    /// The socket path or pipe name is already owned by another (live) agent, or is occupied by
    /// something we must not remove.
    AddressInUse,
    /// The OS refused access to the socket path, its directory, or the pipe.
    PermissionDenied,
    /// Any other failure.
    Unknown,
}

impl StartErrorKind {
    /// Stable string code consumed by Electron. Keep in sync with `startErrorCode` in
    /// `apps/desktop/src/autofill/models/ssh-agent-setup.ts`.
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::AddressInUse => "address-in-use",
            Self::PermissionDenied => "permission-denied",
            Self::Unknown => "unknown",
        }
    }

    /// Classifies a generic I/O error.
    pub(crate) fn from_io(error: &io::Error) -> Self {
        match error.kind() {
            io::ErrorKind::AddrInUse | io::ErrorKind::AlreadyExists => Self::AddressInUse,
            io::ErrorKind::PermissionDenied => Self::PermissionDenied,
            _ => Self::Unknown,
        }
    }
}

impl fmt::Display for StartErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.code())
    }
}

/// Error returned when the agent server fails to start.
///
/// `Display` renders `"<code>: <static detail>"` and never includes a path.
#[derive(Debug, thiserror::Error)]
#[error("{kind}: {detail}")]
pub struct StartError {
    kind: StartErrorKind,
    detail: &'static str,
    #[source]
    source: Option<io::Error>,
}

impl StartError {
    pub(crate) fn new(kind: StartErrorKind, detail: &'static str) -> Self {
        Self {
            kind,
            detail,
            source: None,
        }
    }

    /// Wraps an I/O error, classifying it with [`StartErrorKind::from_io`].
    pub(crate) fn io(detail: &'static str, source: io::Error) -> Self {
        Self::io_with_kind(StartErrorKind::from_io(&source), detail, source)
    }

    pub(crate) fn io_with_kind(
        kind: StartErrorKind,
        detail: &'static str,
        source: io::Error,
    ) -> Self {
        Self {
            kind,
            detail,
            source: Some(source),
        }
    }

    /// The error classification.
    #[must_use]
    pub fn kind(&self) -> StartErrorKind {
        self.kind
    }

    /// Shorthand for `self.kind().code()`.
    #[must_use]
    pub fn code(&self) -> &'static str {
        self.kind.code()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_match_electron_contract() {
        assert_eq!(StartErrorKind::AddressInUse.code(), "address-in-use");
        assert_eq!(StartErrorKind::PermissionDenied.code(), "permission-denied");
        assert_eq!(StartErrorKind::Unknown.code(), "unknown");
    }

    #[test]
    fn from_io_classifies_kinds() {
        let classify = |kind| StartErrorKind::from_io(&io::Error::from(kind));
        assert_eq!(
            classify(io::ErrorKind::AddrInUse),
            StartErrorKind::AddressInUse
        );
        assert_eq!(
            classify(io::ErrorKind::AlreadyExists),
            StartErrorKind::AddressInUse
        );
        assert_eq!(
            classify(io::ErrorKind::PermissionDenied),
            StartErrorKind::PermissionDenied
        );
        assert_eq!(classify(io::ErrorKind::Other), StartErrorKind::Unknown);
    }

    #[test]
    fn display_contains_only_code_and_static_detail() {
        let error = StartError::io(
            "bind failed",
            io::Error::from(io::ErrorKind::PermissionDenied),
        );
        assert_eq!(error.to_string(), "permission-denied: bind failed");
        assert_eq!(error.code(), "permission-denied");
    }
}
