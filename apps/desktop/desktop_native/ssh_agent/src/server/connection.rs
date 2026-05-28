//! SSH agent client connection and connection handler

use std::sync::Arc;

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, trace, warn};

use super::{
    auth_policy::{AuthPolicy, AuthRequest, SignRequest},
    peer_info::PeerInfo,
    protocol::{
        build_identities_answer, build_sign_response, detect_namespace, failure, frame,
        parse_message, AgentMessage, SignFlags,
    },
    KeyStore,
};
use crate::crypto::{PublicKey, SignablePrivateKey};

// Guards against oversized allocations from untrusted length prefixes on the socket.
const MAX_MESSAGE_LEN: usize = 256 * 1024;

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
        debug!(peer_info = ?self.connection.peer_info, "handler starting");

        loop {
            let mut len_buf = [0u8; 4];

            // Read the 4-byte length prefix, yielding to cancellation.
            debug!("handler reading length");
            if read_or_cancel(&mut self.connection.stream, &mut len_buf, &self.token).await {
                break;
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

            // Read the message body, yielding to cancellation.
            debug!("handler reading message");
            if read_or_cancel(&mut self.connection.stream, &mut msg, &self.token).await {
                break;
            }

            if msg.is_empty() {
                debug!("handler skipping empty message");
                continue;
            }

            // Pass Arc clones rather than &self to avoid requiring S: Sync
            let response = handle_message(
                &msg,
                self.connection.peer_info.as_ref(),
                &self.keystore,
                &self.auth_policy,
            )
            .await;

            if let Err(error) = self.connection.stream.write_all(&frame(response)).await {
                error!(%error, "Failed to write response, closing connection");
                break;
            }
        }

        debug!("handler finished");
    }
}

// Reads exactly `buf.len()` bytes from `stream`.
// Returns `true` if the caller should break (cancelled or I/O error).
async fn read_or_cancel<S: AsyncRead + Unpin>(
    stream: &mut S,
    buf: &mut [u8],
    token: &CancellationToken,
) -> bool {
    tokio::select! {
        () = token.cancelled() => {
            debug!("handler received cancellation signal");
            true
        }
        result = stream.read_exact(buf) => match result {
            Ok(_) => false,
            Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => {
                trace!("Connection closed");
                true
            }
            Err(error) => {
                error!(%error, "I/O error on connection");
                true
            }
        },
    }
}

async fn handle_message<K: KeyStore, A: AuthPolicy>(
    msg: &[u8],
    peer_info: Option<&PeerInfo>,
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Vec<u8> {
    let Some(message) = parse_message(msg) else {
        error!("Received malformed message");
        return failure();
    };

    match message {
        AgentMessage::RequestIdentities => handle_list_request(keystore, auth_policy).await,
        AgentMessage::SignRequest {
            public_key,
            data,
            flags,
        } => handle_sign_request(public_key, data, flags, peer_info, keystore, auth_policy).await,
        AgentMessage::Unknown(msg_type) => {
            debug!(msg_type, "Received unhandled message type");
            failure()
        }
    }
}

async fn handle_list_request<K: KeyStore, A: AuthPolicy>(
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Vec<u8> {
    debug!("handling list request");

    let Ok(authorized) = auth_policy
        .authorize(&AuthRequest::List)
        .await
        .inspect_err(|error| error!(%error, "Authorization error for list request"))
    else {
        return failure();
    };

    if !authorized {
        debug!("List request denied by auth policy");
        return failure();
    }

    match keystore.get_all_public_keys_and_names() {
        Ok(keys) => build_identities_answer(keys),
        Err(error) => {
            error!(%error, "Failed to retrieve keys from keystore");
            failure()
        }
    }
}

async fn handle_sign_request<K: KeyStore, A: AuthPolicy>(
    public_key: PublicKey,
    data: Vec<u8>,
    flags: Option<SignFlags>,
    peer_info: Option<&PeerInfo>,
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Vec<u8> {
    debug!("handling sign request");

    let sign_request = SignRequest {
        public_key: public_key.clone(),
        process_name: peer_info.map(|p| p.process_name().to_string()),
        is_forwarding: peer_info.is_none(),
        namespace: detect_namespace(&data),
        flags,
    };

    let Ok(authorized) = auth_policy
        .authorize(&AuthRequest::Sign(sign_request))
        .await
        .inspect_err(|error| error!(%error, "Sign request authorization error"))
    else {
        return failure();
    };

    if !authorized {
        debug!("Sign request denied by auth policy");
        return failure();
    }

    let Ok(maybe_key) = keystore
        .get_private_key(&public_key)
        .inspect_err(|error| error!(%error, "Failed to retrieve key from keystore"))
    else {
        return failure();
    };

    let Some(private_key) = maybe_key else {
        warn!("Key not found in keystore");
        return failure();
    };

    let Ok(signing_key) = SignablePrivateKey::try_from((private_key, flags)).inspect_err(
        |error| warn!(%error, ?flags, "Unable to create signable key with provided request input"),
    ) else {
        return failure();
    };

    build_sign_response(&signing_key.sign(&data))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use mockall::predicate::eq;

    use crate::{
        authorization::AuthError,
        crypto::{PrivateKey, PublicKey},
        server::{AuthPolicy, AuthRequest},
        storage::keystore::MockKeyStore,
    };

    const FAILURE: u8 = 5;
    const REQUEST_IDENTITIES: u8 = 11;
    const IDENTITIES_ANSWER: u8 = 12;
    const SIGN_REQUEST: u8 = 13;
    const SIGN_RESPONSE: u8 = 14;

    fn make_sign_request_msg(blob: &[u8], data: &[u8], flags: u32) -> Vec<u8> {
        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&(blob.len() as u32).to_be_bytes());
        msg.extend_from_slice(blob);
        msg.extend_from_slice(&(data.len() as u32).to_be_bytes());
        msg.extend_from_slice(data);
        msg.extend_from_slice(&flags.to_be_bytes());
        msg
    }

    fn make_minimal_rsa_blob() -> Vec<u8> {
        let alg = b"ssh-rsa";
        let mut blob = Vec::new();
        blob.extend_from_slice(&(alg.len() as u32).to_be_bytes());
        blob.extend_from_slice(alg);
        blob
    }

    fn make_minimal_ed25519_blob() -> Vec<u8> {
        let alg = b"ssh-ed25519";
        let key_bytes = [0u8; 32];
        let mut blob = Vec::new();
        blob.extend_from_slice(&(alg.len() as u32).to_be_bytes());
        blob.extend_from_slice(alg);
        blob.extend_from_slice(&(key_bytes.len() as u32).to_be_bytes());
        blob.extend_from_slice(&key_bytes);
        blob
    }

    struct ErrorAuthPolicy;

    #[async_trait::async_trait]
    impl AuthPolicy for ErrorAuthPolicy {
        async fn authorize(&self, _: &AuthRequest) -> Result<bool, AuthError> {
            Err(AuthError::KeyNotFound)
        }
    }

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

        let response = super::handle_message(&[99u8], None, &keystore, &auth_policy).await;

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

        let response = super::handle_message(
            &[REQUEST_IDENTITIES],
            None,
            &Arc::new(keystore),
            &auth_policy,
        )
        .await;

        assert_eq!(response[0], IDENTITIES_ANSWER);
        assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 1);
    }

    #[tokio::test]
    async fn list_request_when_denied_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysDenyPolicy);

        let response =
            super::handle_message(&[REQUEST_IDENTITIES], None, &keystore, &auth_policy).await;

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

        let response = super::handle_message(
            &[REQUEST_IDENTITIES],
            None,
            &Arc::new(keystore),
            &auth_policy,
        )
        .await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn sign_request_when_authorized_key_found_returns_sign_response() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let blob = make_minimal_ed25519_blob();
        let expected_public_key = PublicKey {
            alg: "ssh-ed25519".to_string(),
            blob: blob.clone(),
        };

        let private_key = PrivateKey::Ed25519(keypair);
        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .with(eq(expected_public_key))
            .once()
            .return_once(move |_| Ok(Some(private_key)));

        let auth_policy = Arc::new(AlwaysAllowPolicy);
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let response = super::handle_message(&msg, None, &Arc::new(keystore), &auth_policy).await;

        assert_eq!(response[0], SIGN_RESPONSE);
    }

    #[tokio::test]
    async fn sign_request_when_auth_denied_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysDenyPolicy);
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let response = super::handle_message(&msg, None, &keystore, &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn sign_request_when_auth_error_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(ErrorAuthPolicy);
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let response = super::handle_message(&msg, None, &keystore, &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn sign_request_when_key_not_found_in_keystore_returns_failure() {
        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .once()
            .returning(|_| Ok(None));

        let auth_policy = Arc::new(AlwaysAllowPolicy);
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let response = super::handle_message(&msg, None, &Arc::new(keystore), &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn sign_request_when_keystore_error_returns_failure() {
        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .once()
            .returning(|_| Err(anyhow::anyhow!("keystore error")));

        let auth_policy = Arc::new(AlwaysAllowPolicy);
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let response = super::handle_message(&msg, None, &Arc::new(keystore), &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn sign_request_rsa_without_flags_returns_failure() {
        use ssh_key::{private::RsaKeypair, rand_core::OsRng};

        const MIN_RSA_BITS: usize = 2048;
        let keypair = RsaKeypair::random(&mut OsRng, MIN_RSA_BITS).unwrap();
        let blob = make_minimal_rsa_blob();
        let expected_public_key = PublicKey {
            alg: "ssh-rsa".to_string(),
            blob: blob.clone(),
        };

        let private_key = PrivateKey::Rsa(keypair);
        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .with(eq(expected_public_key))
            .once()
            .return_once(move |_| Ok(Some(private_key)));

        let auth_policy = Arc::new(AlwaysAllowPolicy);
        let msg = make_sign_request_msg(&blob, b"test data", 0); // no flags → would imply SHA-1

        let response = super::handle_message(&msg, None, &Arc::new(keystore), &auth_policy).await;

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn sign_request_rsa_sha256_flag_produces_sha256_signature() {
        use ssh_key::{private::RsaKeypair, rand_core::OsRng};

        // SSH_AGENT_RSA_SHA2_256 flag
        const RSA_SHA2_256: u32 = 2;

        const MIN_RSA_BITS: usize = 2048;

        let keypair = RsaKeypair::random(&mut OsRng, MIN_RSA_BITS).unwrap();
        let blob = make_minimal_rsa_blob();
        let expected_public_key = PublicKey {
            alg: "ssh-rsa".to_string(),
            blob: blob.clone(),
        };

        let private_key = PrivateKey::Rsa(keypair);
        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .with(eq(expected_public_key))
            .once()
            .return_once(move |_| Ok(Some(private_key)));

        let auth_policy = Arc::new(AlwaysAllowPolicy);
        let msg = make_sign_request_msg(&blob, b"test data", RSA_SHA2_256);

        let response = super::handle_message(&msg, None, &Arc::new(keystore), &auth_policy).await;

        assert_eq!(response[0], SIGN_RESPONSE);
        let alg_len = u32::from_be_bytes(response[5..9].try_into().unwrap()) as usize;
        let alg_str = std::str::from_utf8(&response[9..9 + alg_len]).unwrap();
        assert_eq!(alg_str, "rsa-sha2-256");
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
