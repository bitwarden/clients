//! Bitwarden's auth policy for SSH agent operations.

use std::sync::{Arc, RwLock};

use thiserror::Error;
use tracing::{debug, error, info};

use crate::{
    approval::{ApprovalError, ApprovalRequester, SignApprovalRequest},
    config::SshAgentConfig,
    server::{AuthPolicy, AuthRequest},
    storage::keystore::KeyStore,
};

/// Errors that can occur during authorization of SSH agent operations.
#[derive(Debug, Error)]
pub enum AuthError {
    /// The approval handler did not receive an approved/denied response.
    #[error(transparent)]
    ApprovalUnresolved(#[from] ApprovalError),

    /// The requested public key was not found in the keystore.
    #[error("Public key not found in keystore")]
    KeyNotFound,

    /// An error occurred while accessing the keystore.
    #[error("Keystore error: {0}")]
    KeystoreError(#[source] anyhow::Error),
}

/// Bitwarden's SSH operation authorization policy:
///
/// - Allows listing keys when the keystore is initialized and otherwise requests approval.
/// - Always requires approval for signing operations
/// - Delegates approval decisions to the provided handler
pub struct BitwardenAuthPolicy<K, H>
where
    K: KeyStore,
    H: ApprovalRequester,
{
    keystore: Arc<K>,
    approval_handler: H,
    config: Arc<SshAgentConfig>,
    active_account_email: Arc<RwLock<String>>,
}

impl<K, H> BitwardenAuthPolicy<K, H>
where
    K: KeyStore,
    H: ApprovalRequester,
{
    pub fn new(
        keystore: Arc<K>,
        approval_handler: H,
        config: Arc<SshAgentConfig>,
        active_account_email: Arc<RwLock<String>>,
    ) -> Self {
        Self {
            keystore,
            approval_handler,
            config,
            active_account_email,
        }
    }
}

#[async_trait::async_trait]
impl<K, H> AuthPolicy for BitwardenAuthPolicy<K, H>
where
    K: KeyStore,
    H: ApprovalRequester,
{
    async fn authorize(&self, request: &AuthRequest) -> Result<bool, AuthError> {
        match request {
            AuthRequest::List => {
                // The keystore being initialized means that the vault has been unlocked and keys
                // received from the vault. The before keystore initialization is a case that arises
                // in BFU (Before First Unlock)- where the vault state is logged into but hasn't
                // yet been unlocked during the app's runtime.
                if !self.keystore.is_initialized() {
                    info!(
                        "Keystore not yet initialized on list request, requesting list approval."
                    );
                    self.approval_handler
                        .request_list_approval()
                        .await
                        .map_err(Into::into)
                } else {
                    info!("Allowing list request.");
                    Ok(true)
                }
            }
            AuthRequest::Sign(sign_request) => {
                let all_keys = self
                    .keystore
                    .get_all_key_meta()
                    .map_err(AuthError::KeystoreError)?;

                let Some(requested) = all_keys
                    .iter()
                    .find(|key| key.public_key == sign_request.public_key)
                else {
                    return Err(AuthError::KeyNotFound);
                };
                let cipher_id = Some(requested.cipher_id.clone());

                // Sign-time guard: if the config does not permit this key for the connection's
                // host and active account, deny without prompting the user.
                let host_fingerprint = sign_request
                    .connection
                    .session_bind
                    .as_ref()
                    .map(|bind| bind.host_fingerprint.as_str());
                let active_account_email = self
                    .active_account_email
                    .read()
                    .map(|email| email.clone())
                    .unwrap_or_default();
                debug!(
                    cipher_id = %requested.cipher_id,
                    ?host_fingerprint,
                    "checking config filter for sign request"
                );
                let permitted = self.config.filter_keys(
                    all_keys.clone(),
                    host_fingerprint,
                    &active_account_email,
                );
                if !permitted
                    .iter()
                    .any(|key| key.public_key == sign_request.public_key)
                {
                    info!(
                        public_key = %sign_request.public_key,
                        "Sign request for key not permitted by config; denying without prompt."
                    );
                    return Ok(false);
                }

                info!(?sign_request, "Requesting sign approval.");

                self.approval_handler
                    .request_sign_approval(SignApprovalRequest {
                        sign_request: sign_request.clone(),
                        cipher_id,
                    })
                    .await
                    .map_err(Into::into)
                    .inspect(|&is_approved| {
                        info!(public_key = %sign_request.public_key, is_approved, "Sign approval response.");
                    })
                    .inspect_err(|error| {
                        error!(%error, public_key = %sign_request.public_key, "Sign request authorization error.");
                    })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use anyhow::anyhow;

    use super::*;
    use crate::{
        approval::{ApprovalError, MockApprovalRequester},
        config::KeyMeta,
        server::{ConnectionContext, SIGNamespace, SessionBindContext},
        storage::keystore::MockKeyStore,
    };

    fn make_policy<K: KeyStore, H: ApprovalRequester>(
        keystore: K,
        approval_handler: H,
    ) -> BitwardenAuthPolicy<K, H> {
        BitwardenAuthPolicy::new(
            Arc::new(keystore),
            approval_handler,
            Arc::new(SshAgentConfig::default()),
            Arc::new(RwLock::new(String::new())),
        )
    }

    fn create_stub_public_key() -> crate::crypto::PublicKey {
        crate::crypto::PublicKey {
            alg: "ssh-ed25519".to_string(),
            blob: vec![1, 2, 3],
        }
    }

    fn create_test_sign_request(
        public_key: crate::crypto::PublicKey,
        connection: ConnectionContext,
        namespace: Option<SIGNamespace>,
    ) -> AuthRequest {
        AuthRequest::Sign(crate::server::SignRequest {
            public_key,
            connection,
            namespace,
        })
    }

    fn create_default_test_sign_request(public_key: crate::crypto::PublicKey) -> AuthRequest {
        create_test_sign_request(
            public_key,
            ConnectionContext {
                process_name: Some(TEST_PROCESS_NAME.to_string()),
                session_bind: None,
            },
            None,
        )
    }

    fn setup_keystore_with_key(
        keystore: &mut MockKeyStore,
        public_key: crate::crypto::PublicKey,
        cipher_id: &str,
    ) {
        let cipher_id = cipher_id.to_string();
        keystore
            .expect_get_all_key_meta()
            .times(1)
            .returning(move || {
                Ok(vec![KeyMeta {
                    public_key: public_key.clone(),
                    name: "Test Key".to_string(),
                    cipher_id: cipher_id.clone(),
                    vault_name: "My vault".to_string(),
                }])
            });
    }

    const TEST_PROCESS_NAME: &str = "ssh";

    #[tokio::test]
    async fn test_authorize_list_initialized_keystore_allows_without_callback() {
        let mut keystore = MockKeyStore::new();
        keystore.expect_is_initialized().once().returning(|| true);
        // Approval handler must NOT be called when keystore is already initialized.
        let approval_handler = MockApprovalRequester::new();

        let policy = make_policy(keystore, approval_handler);

        let result = policy.authorize(&AuthRequest::List).await;

        assert!(
            matches!(result, Ok(true)),
            "Initialized keystore should allow without callback"
        );
    }

    #[tokio::test]
    async fn test_authorize_list_uninitialized_keystore_calls_callback_and_allows() {
        let mut keystore = MockKeyStore::new();
        keystore.expect_is_initialized().once().returning(|| false);
        let mut approval_handler = MockApprovalRequester::new();
        approval_handler
            .expect_request_list_approval()
            .once()
            .returning(|| Ok(true));

        let policy = make_policy(keystore, approval_handler);

        let result = policy.authorize(&AuthRequest::List).await;

        assert!(
            matches!(result, Ok(true)),
            "Uninitialized keystore + approved callback should return Ok(true)"
        );
    }

    #[tokio::test]
    async fn test_authorize_list_uninitialized_keystore_callback_denied_returns_false() {
        let mut keystore = MockKeyStore::new();
        keystore.expect_is_initialized().once().returning(|| false);
        let mut approval_handler = MockApprovalRequester::new();
        approval_handler
            .expect_request_list_approval()
            .once()
            .returning(|| Ok(false));

        let policy = make_policy(keystore, approval_handler);

        let result = policy.authorize(&AuthRequest::List).await;

        assert!(
            matches!(result, Ok(false)),
            "Uninitialized keystore + denied callback should return Ok(false)"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_key_not_found() {
        let mut keystore = MockKeyStore::new();
        let approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_stub_public_key();

        keystore
            .expect_get_all_key_meta()
            .times(1)
            .returning(|| Ok(vec![]));

        let policy = make_policy(keystore, approval_handler);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Err(AuthError::KeyNotFound)),
            "Should return KeyNotFound error"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_keystore_error() {
        let mut keystore = MockKeyStore::new();
        let approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_stub_public_key();

        keystore
            .expect_get_all_key_meta()
            .times(1)
            .returning(|| Err(anyhow!("Keystore error")));

        let policy = make_policy(keystore, approval_handler);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Err(AuthError::KeystoreError(_))),
            "Should return KeystoreError"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_approval_granted() {
        let mut keystore = MockKeyStore::new();
        let mut approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_stub_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request_sign_approval()
            .withf(|req| req.cipher_id.as_deref() == Some("cipher-123"))
            .times(1)
            .returning(|_| Ok(true));

        let policy = make_policy(keystore, approval_handler);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Ok(true)),
            "Should return Ok(true) when approval granted"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_approval_denied() {
        let mut keystore = MockKeyStore::new();
        let mut approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_stub_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request_sign_approval()
            .times(1)
            .returning(|_| Ok(false));

        let policy = make_policy(keystore, approval_handler);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Ok(false)),
            "Should return Ok(false) when approval denied"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_handler_error() {
        let mut keystore = MockKeyStore::new();
        let mut approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_stub_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request_sign_approval()
            .times(1)
            .returning(|_| Err(ApprovalError::HandlerFailed(anyhow!("Handler failed"))));

        let policy = make_policy(keystore, approval_handler);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(
                result,
                Err(AuthError::ApprovalUnresolved(ApprovalError::HandlerFailed(
                    _
                )))
            ),
            "Should return ApprovalUnresolved error"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_context_passed_correctly() {
        let mut keystore = MockKeyStore::new();
        let mut approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_stub_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request_sign_approval()
            .withf(|req| {
                req.sign_request.connection.process_name == Some("test-process".to_string())
                    && req
                        .sign_request
                        .connection
                        .session_bind
                        .as_ref()
                        .is_some_and(|s| s.is_forwarding)
                    && req.sign_request.namespace == Some(SIGNamespace::Unsupported)
            })
            .times(1)
            .returning(|_| Ok(true));

        let policy = make_policy(keystore, approval_handler);

        let request = create_test_sign_request(
            test_pub_key,
            ConnectionContext {
                process_name: Some("test-process".to_string()),
                session_bind: Some(SessionBindContext {
                    is_forwarding: true,
                    host_fingerprint: "test-fingerprint".to_string(),
                }),
            },
            Some(SIGNamespace::Unsupported),
        );
        let result = policy.authorize(&request).await;

        assert!(matches!(result, Ok(true)), "Should pass context correctly");
    }

    #[tokio::test]
    async fn test_authorize_sign_denied_by_config_without_prompt() {
        let mut keystore = MockKeyStore::new();
        // The approval handler must NOT be called when the config disallows the key.
        let approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_stub_public_key();
        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        // identities_only with no matching host rule and no defaults => nothing permitted.
        let config: SshAgentConfig = toml::from_str(
            "[[account]]\n[account.settings]\nidentities_only = true\n[[account.hosts]]\nfingerprint = \"SHA256:other\"\nkeys = [\"Something\"]\n",
        )
        .unwrap();
        let policy = BitwardenAuthPolicy::new(
            Arc::new(keystore),
            approval_handler,
            Arc::new(config),
            Arc::new(RwLock::new(String::new())),
        );

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Ok(false)),
            "Config-disallowed key should be denied without prompting"
        );
    }
}
