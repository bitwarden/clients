//! SSH agent client connection and connection handler

use std::sync::Arc;

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

use super::{
    auth_policy::{AuthPolicy, AuthRequest},
    peer_info::PeerInfo,
    protocol, KeyStore,
};

/// An accepted connection from an SSH agent client, bundling the I/O stream
/// with information about the connecting peer.
pub(crate) struct Connection<S> {
    /// The I/O stream for this connection
    pub(crate) stream: S,
    /// Information about the connected peer process, if available
    pub(crate) peer_info: Option<PeerInfo>,
}

/// Handles an individual SSH agent client connection
pub(crate) struct ConnectionHandler<K, A, S> {
    keystore: Arc<K>,
    auth_policy: Arc<A>,
    connection: Connection<S>,
    token: CancellationToken,
}

impl<K, A, S> ConnectionHandler<K, A, S>
where
    K: KeyStore,
    A: AuthPolicy,
    S: AsyncRead + AsyncWrite + Unpin,
{
    /// Create a new connection handler
    pub fn new(
        keystore: Arc<K>,
        auth_policy: Arc<A>,
        connection: Connection<S>,
        token: CancellationToken,
    ) -> Self {
        Self {
            keystore,
            auth_policy,
            connection,
            token,
        }
    }

    /// Handle incoming SSH agent protocol messages from the client.
    ///
    /// Reads length-prefixed SSH agent protocol frames in a loop, dispatches each
    /// message to the appropriate handler, and writes the framed response back.
    /// Exits on cancellation, EOF, or unrecoverable I/O error.
    pub async fn handle(mut self) {
        info!(peer_info = ?self.connection.peer_info, "Connection handler starting");

        // Guards against oversized allocations from untrusted length prefixes on the socket.
        const MAX_MESSAGE_LEN: usize = 256 * 1024;

        loop {
            let mut len_buf = [0u8; 4];

            tokio::select! {
                () = self.token.cancelled() => {
                    info!("Connection handler received cancellation signal");
                    break;
                }
                result = self.connection.stream.read_exact(&mut len_buf) => {
                    if let Err(error) = result {
                        debug!(%error, "Connection closed");
                        break;
                    }
                }
            }

            let msg_len = u32::from_be_bytes(len_buf) as usize;
            if msg_len > MAX_MESSAGE_LEN {
                warn!(
                    msg_len,
                    "Message length exceeds maximum, closing connection"
                );
                break;
            }
            let mut msg = vec![0u8; msg_len];

            tokio::select! {
                () = self.token.cancelled() => {
                    debug!("Connection handler received cancellation signal");
                    break;
                }
                result = self.connection.stream.read_exact(&mut msg) => {
                    if let Err(error) = result {
                        warn!(%error, "Failed to read message body");
                        break;
                    }
                }
            }

            if msg.is_empty() {
                continue;
            }

            // Pass Arc clones rather than &self to avoid requiring S: Sync
            let response = handle_message(msg[0], &self.keystore, &self.auth_policy).await;

            if let Err(error) = self
                .connection
                .stream
                .write_all(&protocol::frame(response))
                .await
            {
                error!(%error, "Failed to write response, closing connection");
                break;
            }
        }

        debug!("Connection handler finished");
    }
}

async fn handle_message<K: KeyStore, A: AuthPolicy>(
    msg_type: u8,
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Vec<u8> {
    match msg_type {
        protocol::REQUEST_IDENTITIES => handle_list_request(keystore, auth_policy).await,
        unknown => {
            debug!(msg_type = unknown, "Received unhandled message type");
            vec![protocol::FAILURE]
        }
    }
}

async fn handle_list_request<K: KeyStore, A: AuthPolicy>(
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Vec<u8> {
    match auth_policy.authorize(&AuthRequest::List).await {
        Ok(true) => match keystore.get_all_public_keys_and_names() {
            Ok(keys) => protocol::build_identities_answer(keys),
            Err(error) => {
                error!(%error, "Failed to retrieve keys from keystore");
                vec![protocol::FAILURE]
            }
        },
        Ok(false) => {
            debug!("List request denied by auth policy");
            vec![protocol::FAILURE]
        }
        Err(error) => {
            error!(%error, "Authorization error for list request");
            vec![protocol::FAILURE]
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use crate::{
        authorization::AuthError,
        crypto::PublicKey,
        server::{AuthPolicy, AuthRequest},
        storage::keystore::MockKeyStore,
    };

    const FAILURE: u8 = 5;
    const REQUEST_IDENTITIES: u8 = 11;
    const IDENTITIES_ANSWER: u8 = 12;

    struct AlwaysAllowPolicy;

    #[async_trait::async_trait]
    impl AuthPolicy for AlwaysAllowPolicy {
        async fn authorize(&self, _: &AuthRequest) -> Result<bool, AuthError> {
            Ok(true)
        }
    }

    struct AlwaysDenyPolicy;

    #[async_trait::async_trait]
    impl AuthPolicy for AlwaysDenyPolicy {
        async fn authorize(&self, _: &AuthRequest) -> Result<bool, AuthError> {
            Ok(false)
        }
    }

    #[tokio::test]
    async fn unknown_message_type_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysAllowPolicy);

        let response = super::handle_message(99u8, &keystore, &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn list_request_when_authorized_returns_identities_answer() {
        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_all_public_keys_and_names()
            .once()
            .returning(|| {
                Ok(vec![(
                    PublicKey {
                        alg: "ssh-ed25519".to_string(),
                        blob: vec![1, 2, 3],
                    },
                    "Test Key".to_string(),
                )])
            });
        let auth_policy = Arc::new(AlwaysAllowPolicy);

        let response =
            super::handle_message(REQUEST_IDENTITIES, &Arc::new(keystore), &auth_policy).await;

        assert_eq!(response[0], IDENTITIES_ANSWER);
        assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 1);
    }

    #[tokio::test]
    async fn list_request_when_denied_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysDenyPolicy);

        let response = super::handle_message(REQUEST_IDENTITIES, &keystore, &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn list_request_when_keystore_errors_returns_failure() {
        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_all_public_keys_and_names()
            .once()
            .returning(|| Err(anyhow::anyhow!("keystore error")));
        let auth_policy = Arc::new(AlwaysAllowPolicy);

        let response =
            super::handle_message(REQUEST_IDENTITIES, &Arc::new(keystore), &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn oversized_message_length_closes_connection_without_panic() {
        use tokio::io::{duplex, AsyncWriteExt};
        use tokio_util::sync::CancellationToken;

        let (mut client, server) = duplex(1024);
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysAllowPolicy);
        let token = CancellationToken::new();

        let handler = super::ConnectionHandler::new(
            keystore,
            auth_policy,
            super::Connection {
                stream: server,
                peer_info: None,
            },
            token,
        );

        // Send a length one byte over the 256 KiB cap
        let oversized_len = (256 * 1024 + 1) as u32;
        client
            .write_all(&oversized_len.to_be_bytes())
            .await
            .unwrap();

        tokio::time::timeout(std::time::Duration::from_secs(1), handler.handle())
            .await
            .expect("handler should exit, denying oversized message length");
    }
}
