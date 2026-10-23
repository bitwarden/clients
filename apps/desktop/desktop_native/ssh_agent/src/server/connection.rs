//! SSH agent client connection and connection handler

use std::sync::Arc;

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, trace, warn};

use super::{
    auth_policy::{AuthPolicy, AuthRequest, ConnectionContext, SessionBindContext, SignRequest},
    peer_info::PeerInfo,
    protocol::{
        build_identities_answer, build_sign_response, detect_namespace,
        failure as protocol_failure, frame, parse_message, read_ssh_string,
        success as protocol_success, AgentMessage, SignFlags, EXTENSION,
    },
    session_bind::SessionBindState,
    KeyStore,
};
use crate::crypto::{PublicKey, SignablePrivateKey};

// Guards against oversized allocations from untrusted length prefixes on the socket.
const MAX_MESSAGE_LEN: usize = 256 * 1024;
const SESSION_BIND_EXTENSION: &[u8] = b"session-bind@openssh.com";

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

        let mut session_bind_state = SessionBindState::default();

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
            let response = if msg.first() == Some(&EXTENSION) {
                handle_extension_message(&msg[1..], &mut session_bind_state)
            } else {
                handle_message(
                    &msg,
                    self.connection.peer_info.as_ref(),
                    &session_bind_state,
                    &self.keystore,
                    &self.auth_policy,
                )
                .await
            };

            match response {
                Response::Continue(response) => {
                    if let Err(error) = self.connection.stream.write_all(&frame(response)).await {
                        error!(%error, "Failed to write response, closing connection");
                        break;
                    }
                }
                Response::RespondThenClose(response) => {
                    // Best effort: the connection is closed regardless of whether the client
                    // receives the response. No further messages are read from it.
                    let _ = self.connection.stream.write_all(&frame(response)).await;
                    let _ = self.connection.stream.shutdown().await;
                    warn!("Closing connection after a critical failure");
                    break;
                }
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

/// The response to a client message, and whether the connection may continue afterwards.
#[derive(Debug, PartialEq)]
enum Response {
    /// Write the response and keep serving the connection.
    Continue(Vec<u8>),
    /// Write the response, then close the connection without reading further messages.
    RespondThenClose(Vec<u8>),
}

/// SSH_AGENT_SUCCESS; the connection stays open.
fn success() -> Response {
    Response::Continue(protocol_success())
}

/// SSH_AGENT_FAILURE; the connection stays open.
fn failure() -> Response {
    Response::Continue(protocol_failure())
}

/// SSH_AGENT_FAILURE, then the connection is closed without reading further messages.
fn critical_failure() -> Response {
    Response::RespondThenClose(protocol_failure())
}

fn handle_extension_message(payload: &[u8], session_bind_state: &mut SessionBindState) -> Response {
    let Some((name, rest)) = read_ssh_string(payload) else {
        return failure();
    };
    match name {
        SESSION_BIND_EXTENSION => handle_session_bind(rest, session_bind_state),
        _ => {
            warn!(
                name = std::str::from_utf8(name).unwrap_or("<non-utf8>"),
                "Received unsupported extension"
            );
            failure()
        }
    }
}

// A failed or unsupported session-bind must not leave a usable connection behind: requests on
// it would otherwise be treated as local, bypassing the forwarded-host approval boundary.
fn handle_session_bind(payload: &[u8], session_bind_state: &mut SessionBindState) -> Response {
    if session_bind_state.parse_and_verify(payload) {
        success()
    } else {
        warn!("session-bind verification failed");
        critical_failure()
    }
}

async fn handle_message<K: KeyStore, A: AuthPolicy>(
    msg: &[u8],
    peer_info: Option<&PeerInfo>,
    session_bind_state: &SessionBindState,
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Response {
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
        } => {
            handle_sign_request(
                public_key,
                data,
                flags,
                peer_info,
                session_bind_state,
                keystore,
                auth_policy,
            )
            .await
        }
        AgentMessage::Unknown(msg_type) => {
            debug!(msg_type, "Received unhandled message type");
            failure()
        }
    }
}

async fn handle_list_request<K: KeyStore, A: AuthPolicy>(
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Response {
    debug!("handling list request");

    let Ok(authorized) = auth_policy
        .authorize(&AuthRequest::List)
        .await
        .inspect_err(|error| error!(%error, "Authorization error for list request"))
    else {
        return failure();
    };

    if !authorized {
        info!("List request denied.");
        return failure();
    }

    match keystore.get_all_public_keys_and_names() {
        Ok(keys) => Response::Continue(build_identities_answer(keys)),
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
    session_bind_state: &SessionBindState,
    keystore: &Arc<K>,
    auth_policy: &Arc<A>,
) -> Response {
    debug!("handling sign request");

    let sign_request = SignRequest {
        public_key: public_key.clone(),
        namespace: detect_namespace(&data),
        connection: ConnectionContext {
            process_name: peer_info.map(|p| p.process_name().to_string()),
            session_bind: if session_bind_state.host_fingerprint.is_empty() {
                None
            } else {
                Some(SessionBindContext {
                    is_forwarding: session_bind_state.is_forwarding,
                    host_fingerprint: session_bind_state.host_fingerprint.clone(),
                })
            },
        },
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

    Response::Continue(build_sign_response(&signing_key.sign(&data)))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use mockall::predicate::eq;

    use crate::{
        authorization::AuthError,
        crypto::{PrivateKey, PublicKey},
        server::{session_bind::SessionBindState, AuthPolicy, AuthRequest},
        storage::keystore::MockKeyStore,
    };
    const FAILURE: u8 = 5;
    const SUCCESS: u8 = 6;
    const REQUEST_IDENTITIES: u8 = 11;
    const IDENTITIES_ANSWER: u8 = 12;
    const SIGN_REQUEST: u8 = 13;
    const SIGN_RESPONSE: u8 = 14;

    use crate::server::test_common::{
        make_minimal_ed25519_blob, make_session_bind_payload_ecdsa,
        make_session_bind_payload_ed25519, make_session_bind_payload_host_certificate,
        make_session_bind_payload_unsupported_host_key, make_sign_request_msg, write_ssh_string,
        AlwaysAllowPolicy,
    };

    fn make_minimal_rsa_blob() -> Vec<u8> {
        let alg = b"ssh-rsa";
        let mut blob = Vec::new();
        blob.extend_from_slice(&(alg.len() as u32).to_be_bytes());
        blob.extend_from_slice(alg);
        blob
    }

    // Builds the slice that handle_extension_message receives: [string name][raw payload]
    fn make_extension_payload(name: &[u8], data: &[u8]) -> Vec<u8> {
        let mut payload = Vec::new();
        write_ssh_string(&mut payload, name);
        payload.extend_from_slice(data);
        payload
    }

    // Unwraps a response that must keep the connection open.
    fn expect_continue(response: super::Response) -> Vec<u8> {
        match response {
            super::Response::Continue(bytes) => bytes,
            super::Response::RespondThenClose(_) => {
                panic!("agent requests must not close the connection")
            }
        }
    }

    struct ErrorAuthPolicy;

    #[async_trait::async_trait]
    impl AuthPolicy for ErrorAuthPolicy {
        async fn authorize(&self, _: &AuthRequest) -> Result<bool, AuthError> {
            Err(AuthError::KeyNotFound)
        }
    }

    struct AlwaysDenyPolicy;

    #[async_trait::async_trait]
    impl AuthPolicy for AlwaysDenyPolicy {
        async fn authorize(&self, _: &AuthRequest) -> Result<bool, AuthError> {
            Ok(false)
        }
    }

    struct CapturingAuthPolicy {
        captured: std::sync::Mutex<Option<AuthRequest>>,
    }

    #[async_trait::async_trait]
    impl AuthPolicy for CapturingAuthPolicy {
        async fn authorize(&self, req: &AuthRequest) -> Result<bool, AuthError> {
            *self.captured.lock().unwrap() = Some(req.clone());
            Ok(true)
        }
    }

    #[tokio::test]
    async fn unknown_message_type_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysAllowPolicy);

        let response = expect_continue(
            super::handle_message(
                &[99u8],
                None,
                &SessionBindState::default(),
                &keystore,
                &auth_policy,
            )
            .await,
        );

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn malformed_message_returns_failure_and_keeps_connection_open() {
        // A sign request truncated inside the key blob length cannot be parsed.
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysAllowPolicy);

        let response = expect_continue(
            super::handle_message(
                &[SIGN_REQUEST, 0, 0],
                None,
                &SessionBindState::default(),
                &keystore,
                &auth_policy,
            )
            .await,
        );

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

        let response = expect_continue(
            super::handle_message(
                &[REQUEST_IDENTITIES],
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

        assert_eq!(response[0], IDENTITIES_ANSWER);
        assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 1);
    }

    #[tokio::test]
    async fn list_request_when_denied_returns_failure() {
        let keystore = MockKeyStore::new();
        let auth_policy = Arc::new(AlwaysDenyPolicy);

        let response = expect_continue(
            super::handle_message(
                &[REQUEST_IDENTITIES],
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

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

        let response = expect_continue(
            super::handle_message(
                &[REQUEST_IDENTITIES],
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

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

        let response = expect_continue(
            super::handle_message(
                &msg,
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

        assert_eq!(response[0], SIGN_RESPONSE);
    }

    #[tokio::test]
    async fn sign_request_when_auth_denied_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(AlwaysDenyPolicy);
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let response = expect_continue(
            super::handle_message(
                &msg,
                None,
                &SessionBindState::default(),
                &keystore,
                &auth_policy,
            )
            .await,
        );

        assert_eq!(response, vec![FAILURE]);
    }

    #[tokio::test]
    async fn sign_request_when_auth_error_returns_failure() {
        let keystore = Arc::new(MockKeyStore::new());
        let auth_policy = Arc::new(ErrorAuthPolicy);
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let response = expect_continue(
            super::handle_message(
                &msg,
                None,
                &SessionBindState::default(),
                &keystore,
                &auth_policy,
            )
            .await,
        );

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

        let response = expect_continue(
            super::handle_message(
                &msg,
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

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

        let response = expect_continue(
            super::handle_message(
                &msg,
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

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

        let response = expect_continue(
            super::handle_message(
                &msg,
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

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

        let response = expect_continue(
            super::handle_message(
                &msg,
                None,
                &SessionBindState::default(),
                &Arc::new(keystore),
                &auth_policy,
            )
            .await,
        );

        assert_eq!(response[0], SIGN_RESPONSE);
        let alg_len = u32::from_be_bytes(response[5..9].try_into().unwrap()) as usize;
        let alg_str = std::str::from_utf8(&response[9..9 + alg_len]).unwrap();
        assert_eq!(alg_str, "rsa-sha2-256");
    }

    #[test]
    fn extension_truncated_name_returns_failure() {
        let mut state = SessionBindState::default();
        let response = super::handle_extension_message(&[0u8, 1u8, 2u8], &mut state);
        assert_eq!(response, super::Response::Continue(vec![FAILURE]));
    }

    #[test]
    fn extension_unknown_name_returns_failure() {
        let payload = make_extension_payload(b"query", &[]);
        let mut state = SessionBindState::default();
        let response = super::handle_extension_message(&payload, &mut state);
        assert_eq!(response, super::Response::Continue(vec![FAILURE]));
    }

    #[test]
    fn session_bind_invalid_payload_returns_failure() {
        let payload = make_extension_payload(b"session-bind@openssh.com", &[0xDE, 0xAD]);
        let mut state = SessionBindState::default();
        let response = super::handle_extension_message(&payload, &mut state);
        assert_eq!(response, super::Response::RespondThenClose(vec![FAILURE]));
        assert!(!state.is_forwarding);
        assert!(state.host_fingerprint.is_empty());
    }

    #[test]
    fn session_bind_valid_not_forwarding_returns_success() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let bind_payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        let payload = make_extension_payload(b"session-bind@openssh.com", &bind_payload);

        let mut state = SessionBindState::default();
        let response = super::handle_extension_message(&payload, &mut state);
        assert_eq!(response, super::Response::Continue(vec![SUCCESS]));
        assert!(!state.is_forwarding);
    }

    #[test]
    fn session_bind_valid_forwarding_returns_success_and_sets_flag() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let bind_payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], true);
        let payload = make_extension_payload(b"session-bind@openssh.com", &bind_payload);

        let mut state = SessionBindState::default();
        let response = super::handle_extension_message(&payload, &mut state);
        assert_eq!(response, super::Response::Continue(vec![SUCCESS]));
        assert!(state.is_forwarding);
    }

    #[test]
    fn session_bind_is_forwarding_latched_on_rebind() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut state = SessionBindState::default();

        let forwarding_payload = make_session_bind_payload_ed25519(&keypair, &[0x01u8; 32], true);
        let ext1 = make_extension_payload(b"session-bind@openssh.com", &forwarding_payload);
        let r1 = super::handle_extension_message(&ext1, &mut state);
        assert_eq!(r1, super::Response::Continue(vec![SUCCESS]));
        assert!(
            state.is_forwarding,
            "first bind (forwarding=true) should set flag"
        );

        let not_forwarding_payload =
            make_session_bind_payload_ed25519(&keypair, &[0x02u8; 32], false);
        let ext2 = make_extension_payload(b"session-bind@openssh.com", &not_forwarding_payload);
        let r2 = super::handle_extension_message(&ext2, &mut state);
        assert_eq!(r2, super::Response::Continue(vec![SUCCESS]));
        assert!(
            state.is_forwarding,
            "latch must not be cleared by a non-forwarding rebind"
        );
    }

    #[tokio::test]
    async fn session_bind_is_forwarding_propagates_to_sign_request_auth() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let bind_payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], true);
        let ext_payload = make_extension_payload(b"session-bind@openssh.com", &bind_payload);

        let mut state = SessionBindState::default();
        let bind_response = super::handle_extension_message(&ext_payload, &mut state);
        assert_eq!(bind_response, super::Response::Continue(vec![SUCCESS]));
        assert!(state.is_forwarding);

        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .once()
            .returning(|_| Ok(None));

        let capturing_policy = Arc::new(CapturingAuthPolicy {
            captured: std::sync::Mutex::new(None),
        });

        let _ =
            super::handle_message(&msg, None, &state, &Arc::new(keystore), &capturing_policy).await;

        let captured = capturing_policy.captured.lock().unwrap();
        if let Some(AuthRequest::Sign(sign_req)) = captured.as_ref() {
            assert!(
                sign_req
                    .connection
                    .session_bind
                    .as_ref()
                    .is_some_and(|s| s.is_forwarding),
                "is_forwarding must propagate to auth"
            );
        } else {
            panic!("expected Sign auth request to be captured");
        }
    }

    #[tokio::test]
    async fn host_fingerprint_propagates_to_sign_request_auth() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let bind_payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], true);
        let ext_payload = make_extension_payload(b"session-bind@openssh.com", &bind_payload);

        let mut state = SessionBindState::default();
        super::handle_extension_message(&ext_payload, &mut state);
        let expected_fingerprint = state.host_fingerprint.clone();
        assert!(!expected_fingerprint.is_empty());

        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .once()
            .returning(|_| Ok(None));

        let capturing_policy = Arc::new(CapturingAuthPolicy {
            captured: std::sync::Mutex::new(None),
        });

        let _ =
            super::handle_message(&msg, None, &state, &Arc::new(keystore), &capturing_policy).await;

        let captured = capturing_policy.captured.lock().unwrap();
        if let Some(AuthRequest::Sign(sign_req)) = captured.as_ref() {
            assert_eq!(
                sign_req
                    .connection
                    .session_bind
                    .as_ref()
                    .map(|s| s.host_fingerprint.as_str()),
                Some(expected_fingerprint.as_str()),
                "host_fingerprint must propagate to auth request"
            );
        } else {
            panic!("expected Sign auth request to be captured");
        }
    }

    #[tokio::test]
    async fn sign_request_without_session_bind_has_no_host_fingerprint() {
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"test data", 0);

        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_private_key()
            .once()
            .returning(|_| Ok(None));

        let capturing_policy = Arc::new(CapturingAuthPolicy {
            captured: std::sync::Mutex::new(None),
        });

        let _ = super::handle_message(
            &msg,
            None,
            &SessionBindState::default(),
            &Arc::new(keystore),
            &capturing_policy,
        )
        .await;

        let captured = capturing_policy.captured.lock().unwrap();
        if let Some(AuthRequest::Sign(sign_req)) = captured.as_ref() {
            assert!(
                sign_req.connection.session_bind.is_none(),
                "session_bind must be None when no session-bind was received"
            );
        } else {
            panic!("expected Sign auth request to be captured");
        }
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

    // ---- connection-level session-bind tests (full handler loop over an in-memory stream) ----

    const EXTENSION: u8 = 27;

    /// Counts authorization calls and captures the last request, approving every request.
    #[derive(Default)]
    struct CountingAuthPolicy {
        calls: std::sync::atomic::AtomicUsize,
        captured: std::sync::Mutex<Option<AuthRequest>>,
    }

    impl CountingAuthPolicy {
        fn calls(&self) -> usize {
            self.calls.load(std::sync::atomic::Ordering::SeqCst)
        }
    }

    #[async_trait::async_trait]
    impl AuthPolicy for CountingAuthPolicy {
        async fn authorize(&self, req: &AuthRequest) -> Result<bool, AuthError> {
            self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            *self.captured.lock().unwrap() = Some(req.clone());
            Ok(true)
        }
    }

    fn framed(body: &[u8]) -> Vec<u8> {
        let mut out = (body.len() as u32).to_be_bytes().to_vec();
        out.extend_from_slice(body);
        out
    }

    fn framed_session_bind(bind_payload: &[u8]) -> Vec<u8> {
        let mut body = vec![EXTENSION];
        body.extend(make_extension_payload(
            b"session-bind@openssh.com",
            bind_payload,
        ));
        framed(&body)
    }

    fn framed_sign_request() -> Vec<u8> {
        framed(&make_sign_request_msg(
            &make_minimal_ed25519_blob(),
            b"test data",
            0,
        ))
    }

    /// Runs a connection handler over an in-memory stream. The keystore has no expectations, so
    /// any attempt to look up or sign with a key panics the handler task.
    fn spawn_handler(
        auth_policy: Arc<CountingAuthPolicy>,
        keystore: MockKeyStore,
    ) -> (tokio::io::DuplexStream, tokio::task::JoinHandle<()>) {
        let (client, server) = tokio::io::duplex(64 * 1024);
        let handler = super::ConnectionHandler::new(
            Arc::new(keystore),
            auth_policy,
            super::Connection {
                stream: server,
                peer_info: None,
            },
            tokio_util::sync::CancellationToken::new(),
        );
        (client, tokio::spawn(handler.handle()))
    }

    /// Reads one response frame, or `None` if the server closed the connection.
    async fn read_frame(client: &mut tokio::io::DuplexStream) -> Option<Vec<u8>> {
        use tokio::io::AsyncReadExt;

        let mut len_buf = [0u8; 4];
        let read = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            client.read_exact(&mut len_buf),
        )
        .await
        .expect("timed out waiting for the server");
        if read.is_err() {
            return None;
        }
        let mut body = vec![0u8; u32::from_be_bytes(len_buf) as usize];
        client.read_exact(&mut body).await.ok()?;
        Some(body)
    }

    async fn assert_closed(
        client: &mut tokio::io::DuplexStream,
        handler: tokio::task::JoinHandle<()>,
    ) {
        assert_eq!(
            read_frame(client).await,
            None,
            "connection must be closed after a failed session-bind"
        );
        tokio::time::timeout(std::time::Duration::from_secs(5), handler)
            .await
            .expect("handler should exit")
            .expect("handler must not panic (no keystore access)");
    }

    #[tokio::test]
    async fn failed_bind_returns_failure_then_closes_connection() {
        use tokio::io::AsyncWriteExt;

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        client
            .write_all(&framed_session_bind(&[0xDE, 0xAD, 0xBE, 0xEF]))
            .await
            .unwrap();

        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));
        assert_closed(&mut client, handler).await;
        assert_eq!(policy.calls(), 0);
    }

    #[tokio::test]
    async fn unsupported_host_key_bind_closes_connection() {
        use tokio::io::AsyncWriteExt;

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        client
            .write_all(&framed_session_bind(
                &make_session_bind_payload_unsupported_host_key(true),
            ))
            .await
            .unwrap();

        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));
        assert_closed(&mut client, handler).await;
        assert_eq!(policy.calls(), 0);
    }

    // Documented limitation: host certificates are not supported for session-bind, so the
    // connection is closed instead of serving later requests as local.
    #[tokio::test]
    async fn host_certificate_bind_closes_connection_without_signing() {
        use tokio::io::AsyncWriteExt;

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        let mut batch = framed_session_bind(&make_session_bind_payload_host_certificate(true));
        batch.extend(framed_sign_request());
        client.write_all(&batch).await.unwrap();

        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));
        assert_closed(&mut client, handler).await;
        assert_eq!(policy.calls(), 0);
    }

    #[tokio::test]
    async fn malformed_bind_trailing_data_closes_connection() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};
        use tokio::io::AsyncWriteExt;

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut bind_payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], true);
        bind_payload.push(0u8);

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        client
            .write_all(&framed_session_bind(&bind_payload))
            .await
            .unwrap();

        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));
        assert_closed(&mut client, handler).await;
        assert_eq!(policy.calls(), 0);
    }

    #[tokio::test]
    async fn queued_sign_after_failed_bind_is_never_processed() {
        use tokio::io::AsyncWriteExt;

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        // Pipeline the failing bind and a sign request in a single write.
        let mut batch = framed_session_bind(&make_session_bind_payload_unsupported_host_key(true));
        batch.extend(framed_sign_request());
        batch.extend(framed_sign_request());
        client.write_all(&batch).await.unwrap();

        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));
        assert_closed(&mut client, handler).await;
        assert_eq!(
            policy.calls(),
            0,
            "queued sign requests must never reach authorization"
        );
    }

    #[tokio::test]
    async fn queued_list_after_failed_bind_is_never_processed() {
        use tokio::io::AsyncWriteExt;

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        let mut batch = framed_session_bind(&[0xDE, 0xAD]);
        batch.extend(framed(&[REQUEST_IDENTITIES]));
        client.write_all(&batch).await.unwrap();

        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));
        assert_closed(&mut client, handler).await;
        assert_eq!(policy.calls(), 0);
    }

    #[tokio::test]
    async fn valid_then_failed_rebind_closes_connection_without_signing() {
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};
        use tokio::io::AsyncWriteExt;

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        // First hop: a valid forwarded Ed25519 bind succeeds.
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let valid = make_session_bind_payload_ed25519(&keypair, &[0x01u8; 32], true);
        client
            .write_all(&framed_session_bind(&valid))
            .await
            .unwrap();
        assert_eq!(read_frame(&mut client).await, Some(vec![SUCCESS]));

        // Next hop: an unverifiable bind must not fall back to the first hop's fingerprint.
        let mut batch = framed_session_bind(&make_session_bind_payload_unsupported_host_key(true));
        batch.extend(framed_sign_request());
        client.write_all(&batch).await.unwrap();

        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));
        assert_closed(&mut client, handler).await;
        assert_eq!(policy.calls(), 0);
    }

    #[tokio::test]
    async fn ecdsa_bind_propagates_forwarded_context_to_sign_request() {
        use ssh_key::{private::EcdsaKeypair, rand_core::OsRng, EcdsaCurve, HashAlg};
        use tokio::io::AsyncWriteExt;

        for curve in [
            EcdsaCurve::NistP256,
            EcdsaCurve::NistP384,
            EcdsaCurve::NistP521,
        ] {
            let keypair = EcdsaKeypair::random(&mut OsRng, curve).unwrap();
            let expected_fingerprint = ssh_key::PublicKey::from(ssh_key::public::KeyData::Ecdsa(
                ssh_key::public::EcdsaPublicKey::from(&keypair),
            ))
            .fingerprint(HashAlg::Sha256)
            .to_string();

            let mut keystore = MockKeyStore::new();
            keystore
                .expect_get_private_key()
                .once()
                .returning(|_| Ok(None));
            let policy = Arc::new(CountingAuthPolicy::default());
            let (mut client, handler) = spawn_handler(policy.clone(), keystore);

            let bind = make_session_bind_payload_ecdsa(&keypair, &[0x42u8; 32], true);
            client.write_all(&framed_session_bind(&bind)).await.unwrap();
            assert_eq!(
                read_frame(&mut client).await,
                Some(vec![SUCCESS]),
                "{curve:?} bind should verify"
            );

            client.write_all(&framed_sign_request()).await.unwrap();
            // Key is not in the keystore, so the sign itself fails after authorization.
            assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));

            drop(client);
            handler.await.unwrap();

            assert_eq!(policy.calls(), 1);
            let captured = policy.captured.lock().unwrap();
            let Some(AuthRequest::Sign(sign_req)) = captured.as_ref() else {
                panic!("expected Sign auth request to be captured");
            };
            let bind = sign_req
                .connection
                .session_bind
                .as_ref()
                .expect("forwarded context must be present");
            assert!(bind.is_forwarding, "{curve:?} must be forwarded");
            assert_eq!(bind.host_fingerprint, expected_fingerprint);
        }
    }

    #[tokio::test]
    async fn response_write_failure_closes_connection() {
        use tokio::io::AsyncWriteExt;

        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), MockKeyStore::new());

        // Queue a request, then disconnect before the response can be written.
        client.write_all(&framed(&[99u8])).await.unwrap();
        drop(client);

        tokio::time::timeout(std::time::Duration::from_secs(5), handler)
            .await
            .expect("handler should exit when the response cannot be written")
            .expect("handler must not panic");
        assert_eq!(policy.calls(), 0);
    }

    #[tokio::test]
    async fn unknown_extension_does_not_close_connection() {
        use tokio::io::AsyncWriteExt;

        let mut keystore = MockKeyStore::new();
        keystore
            .expect_get_all_public_keys_and_names()
            .once()
            .returning(|| Ok(vec![]));
        let policy = Arc::new(CountingAuthPolicy::default());
        let (mut client, handler) = spawn_handler(policy.clone(), keystore);

        let mut body = vec![EXTENSION];
        body.extend(make_extension_payload(b"query", &[]));
        client.write_all(&framed(&body)).await.unwrap();
        assert_eq!(read_frame(&mut client).await, Some(vec![FAILURE]));

        // The connection is still served.
        client
            .write_all(&framed(&[REQUEST_IDENTITIES]))
            .await
            .unwrap();
        let response = read_frame(&mut client).await.expect("connection open");
        assert_eq!(response[0], IDENTITIES_ANSWER);

        drop(client);
        handler.await.unwrap();
        assert_eq!(policy.calls(), 1);
    }
}
