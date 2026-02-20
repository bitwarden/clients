//! Connection handler for SSH agent client connections

use std::sync::Arc;

use tokio::io::{AsyncRead, AsyncWrite};
use tokio_util::sync::CancellationToken;
use tracing::info;

use super::auth_policy::AuthPolicy;
use crate::crypto::keystore::KeyStore;

/// Handles an individual SSH agent client connection
pub(crate) struct ConnectionHandler<K, A, S> {
    keystore: Arc<K>,
    auth_policy: Arc<A>,
    stream: S,
    token: CancellationToken,
}

impl<K, A, S> ConnectionHandler<K, A, S>
where
    K: KeyStore,
    A: AuthPolicy,
    S: AsyncRead + AsyncWrite + Unpin,
{
    /// Create a new connection handler
    pub fn new(keystore: Arc<K>, auth_policy: Arc<A>, stream: S, token: CancellationToken) -> Self {
        Self {
            keystore,
            auth_policy,
            stream,
            token,
        }
    }

    /// Handle incoming SSH agent protocol messages from the client
    #[allow(clippy::never_loop)] // TODO remove
    pub async fn handle(self) {
        info!("Connection handler started");

        loop {
            tokio::select! {
                () = self.token.cancelled() => {
                    info!("Connection handler received cancellation signal");
                    break;
                }

                // TODO: read SSH protocol message from stream
                // TODO: parse message type, use auth policy and keystore to satisfy requests
                // TODO: build response and write back to stream
            }
        }

        info!("Connection handler shutting down");
    }
}
