//! SSH agent client connection listener abstraction

use anyhow::Result;
use tokio::io::{AsyncRead, AsyncWrite};

use super::peer_info::PeerInfo;

/// Implementatiors handle platform-specific socket/pipe creation and connection acceptance.
pub(crate) trait Listener: Send + Sync {
    /// The stream type returned by `accept()`
    type Stream: AsyncRead + AsyncWrite + Send + Unpin;

    /// Accept a new connection, returning the stream and peer information
    async fn accept(&mut self) -> Result<(Self::Stream, PeerInfo)>;
}
