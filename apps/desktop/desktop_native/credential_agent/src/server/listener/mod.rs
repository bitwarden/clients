//! Platform-specific transports the credential agent accepts clients on.

#[cfg(unix)]
pub(crate) mod unix;

#[cfg(windows)]
pub(crate) mod windows;

use anyhow::Result;
use tokio::io::{AsyncRead, AsyncWrite};

use crate::provider::PeerContext;

/// An accepted client connection, paired with what we know about the peer process.
pub(crate) struct Connection<S> {
    pub(crate) stream: S,
    pub(crate) peer: PeerContext,
}

/// Implementors create the platform socket/pipe and accept clients on it.
#[async_trait::async_trait]
pub(crate) trait Listener: Send + Sync + 'static {
    type Stream: AsyncRead + AsyncWrite + Send + Unpin + 'static;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>>;
}

/// Creates the listener for the current platform.
#[cfg(unix)]
pub(crate) fn create_listener() -> Result<impl Listener> {
    unix::UnixListener::new()
}

/// Creates the listener for the current platform.
#[cfg(windows)]
pub(crate) fn create_listener() -> Result<impl Listener> {
    windows::WindowsListener::new()
}
