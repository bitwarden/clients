//! Platform transports the agent accepts clients on.

#[cfg(unix)]
pub(crate) mod unix;

#[cfg(windows)]
pub(crate) mod windows;

use anyhow::Result;
use tokio::io::{AsyncRead, AsyncWrite};

/// An accepted client and the kernel-reported pid of the process on the other end.
pub(crate) struct Connection<S> {
    pub(crate) stream: S,
    pub(crate) peer_pid: Option<u32>,
}

#[async_trait::async_trait]
pub(crate) trait Listener: Send + Sync + 'static {
    type Stream: AsyncRead + AsyncWrite + Send + Unpin + 'static;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>>;
}

#[cfg(unix)]
pub(crate) fn create_listener() -> Result<impl Listener> {
    unix::UnixListener::new()
}

#[cfg(windows)]
pub(crate) fn create_listener() -> Result<impl Listener> {
    windows::WindowsListener::new()
}
