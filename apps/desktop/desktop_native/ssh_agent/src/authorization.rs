//! Bitwarden's auth policy for SSH agent operations.

use std::sync::Arc;

use thiserror::Error;
use tracing::{error, info};

use crate::{
    activity::{Activity, ActivityObserver, ActivityOperation, ActivityOutcome},
    approval::{ApprovalError, ApprovalRequester, SignApprovalRequest},
    crypto::{PublicKey, QueryableKeyData},
    server::{AuthPolicy, AuthRequest, ConnectionContext, SignRequest},
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
/// - Reports every decision to the activity observer
pub struct BitwardenAuthPolicy<K, H, O>
where
    K: KeyStore,
    H: ApprovalRequester,
    O: ActivityObserver,
{
    keystore: Arc<K>,
    approval_handler: H,
    activity_observer: O,
}

impl<K, H, O> BitwardenAuthPolicy<K, H, O>
where
    K: KeyStore,
    H: ApprovalRequester,
    O: ActivityObserver,
{
    pub fn new(keystore: Arc<K>, approval_handler: H, activity_observer: O) -> Self {
        Self {
            keystore,
            approval_handler,
            activity_observer,
        }
    }

    async fn authorize_list(&self) -> Result<bool, AuthError> {
        // The keystore being initialized means that the vault has been unlocked and keys
        // received from the vault. The before keystore initialization is a case that arises
        // in BFU (Before First Unlock)- where the vault state is logged into but hasn't
        // yet been unlocked during the app's runtime.
        if !self.keystore.is_initialized() {
            info!("Keystore not yet initialized on list request, requesting list approval.");
            self.approval_handler
                .request_list_approval()
                .await
                .map_err(Into::into)
        } else {
            info!("Allowing list request.");
            Ok(true)
        }
    }

    fn cipher_id(&self, public_key: &PublicKey) -> Result<String, AuthError> {
        match self.keystore.get(public_key) {
            Ok(Some(key_data)) => Ok(key_data.cipher_id().clone()),
            Ok(None) => Err(AuthError::KeyNotFound),
            Err(error) => Err(AuthError::KeystoreError(error)),
        }
    }

    async fn authorize_sign(
        &self,
        sign_request: &SignRequest,
        cipher_id: String,
    ) -> Result<bool, AuthError> {
        info!(?sign_request, "Requesting sign approval.");

        self.approval_handler
            .request_sign_approval(SignApprovalRequest {
                sign_request: sign_request.clone(),
                cipher_id: Some(cipher_id),
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

    fn record(
        &self,
        operation: ActivityOperation,
        connection: &ConnectionContext,
        result: &Result<bool, AuthError>,
    ) {
        let outcome = match result {
            Ok(true) => ActivityOutcome::Allowed,
            Ok(false) => ActivityOutcome::Denied,
            Err(_) => ActivityOutcome::Failed,
        };

        self.activity_observer.observe(Activity {
            operation,
            connection: connection.clone(),
            outcome,
        });
    }
}

#[async_trait::async_trait]
impl<K, H, O> AuthPolicy for BitwardenAuthPolicy<K, H, O>
where
    K: KeyStore,
    H: ApprovalRequester,
    O: ActivityObserver,
{
    async fn authorize(&self, request: &AuthRequest) -> Result<bool, AuthError> {
        match request {
            AuthRequest::List(connection) => {
                let result = self.authorize_list().await;
                self.record(ActivityOperation::List, connection, &result);
                result
            }
            AuthRequest::Sign(sign_request) => {
                let (cipher_id, result) = match self.cipher_id(&sign_request.public_key) {
                    Ok(cipher_id) => (
                        Some(cipher_id.clone()),
                        self.authorize_sign(sign_request, cipher_id).await,
                    ),
                    Err(error) => (None, Err(error)),
                };

                let operation = ActivityOperation::Sign {
                    cipher_id,
                    namespace: sign_request.namespace.clone(),
                };
                self.record(operation, &sign_request.connection, &result);
                result
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use anyhow::anyhow;
    use mockall::predicate::*;

    use super::*;
    use crate::{
        activity::MockActivityObserver,
        approval::{ApprovalError, MockApprovalRequester},
        server::{ConnectionContext, SIGNamespace, SessionBindContext},
        storage::{keydata::MockQueryableKeyData, keystore::MockKeyStore},
    };

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
        create_test_sign_request(public_key, test_connection(), None)
    }

    fn test_connection() -> ConnectionContext {
        ConnectionContext {
            process_name: Some(TEST_PROCESS_NAME.to_string()),
            command: Some(TEST_COMMAND.to_string()),
            caller_app: Some(TEST_CALLER_APP.to_string()),
            host_app: Some(TEST_HOST_APP.to_string()),
            session_bind: None,
        }
    }

    // Accepts any activity, for tests about the decision itself.
    fn any_observer() -> MockActivityObserver {
        let mut observer = MockActivityObserver::new();
        observer.expect_observe().return_const(());
        observer
    }

    // Expects exactly one activity matching `matches`.
    fn expect_activity(matches: fn(&Activity) -> bool) -> MockActivityObserver {
        let mut observer = MockActivityObserver::new();
        observer
            .expect_observe()
            .withf(matches)
            .once()
            .return_const(());
        observer
    }

    fn setup_keystore_with_key(
        keystore: &mut MockKeyStore,
        public_key: crate::crypto::PublicKey,
        cipher_id: &str,
    ) {
        let cipher_id = cipher_id.to_string();
        keystore
            .expect_get()
            .with(eq(public_key))
            .times(1)
            .returning(move |_| {
                let mut mock_key_data = MockQueryableKeyData::new();
                mock_key_data
                    .expect_cipher_id()
                    .return_const(cipher_id.clone());
                Ok(Some(mock_key_data))
            });
    }

    const TEST_PROCESS_NAME: &str = "ssh";
    const TEST_COMMAND: &str = "ssh -t example.com";
    const TEST_CALLER_APP: &str = "claude";
    const TEST_HOST_APP: &str = "iTerm2";

    #[tokio::test]
    async fn test_authorize_list_initialized_keystore_allows_without_callback() {
        let mut keystore = MockKeyStore::new();
        keystore.expect_is_initialized().once().returning(|| true);
        // Approval handler must NOT be called when keystore is already initialized.
        let approval_handler = MockApprovalRequester::new();

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

        let result = policy
            .authorize(&AuthRequest::List(test_connection()))
            .await;

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

        let result = policy
            .authorize(&AuthRequest::List(test_connection()))
            .await;

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

        let result = policy
            .authorize(&AuthRequest::List(test_connection()))
            .await;

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
            .expect_get()
            .with(eq(test_pub_key.clone()))
            .times(1)
            .returning(|_| Ok(None));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

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
            .expect_get()
            .with(eq(test_pub_key.clone()))
            .times(1)
            .returning(|_| Err(anyhow!("Keystore error")));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

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

        keystore.expect_get().times(1).returning(|_| {
            let mut mock_key_data = MockQueryableKeyData::new();
            mock_key_data
                .expect_cipher_id()
                .return_const("cipher-123".to_string());
            Ok(Some(mock_key_data))
        });

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, any_observer());

        let request = create_test_sign_request(
            test_pub_key,
            ConnectionContext {
                process_name: Some("test-process".to_string()),
                command: None,
                caller_app: None,
                host_app: None,
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
    async fn test_authorize_list_records_allowed_activity_with_origin() {
        let mut keystore = MockKeyStore::new();
        keystore.expect_is_initialized().once().returning(|| true);
        let observer = expect_activity(|activity| {
            matches!(activity.operation, ActivityOperation::List)
                && activity.outcome == ActivityOutcome::Allowed
                && activity.connection.command.as_deref() == Some(TEST_COMMAND)
                && activity.connection.caller_app.as_deref() == Some(TEST_CALLER_APP)
                && activity.connection.host_app.as_deref() == Some(TEST_HOST_APP)
        });

        let policy =
            BitwardenAuthPolicy::new(Arc::new(keystore), MockApprovalRequester::new(), observer);

        let result = policy
            .authorize(&AuthRequest::List(test_connection()))
            .await;

        assert!(matches!(result, Ok(true)));
    }

    #[tokio::test]
    async fn test_authorize_sign_records_denied_activity_with_cipher() {
        let mut keystore = MockKeyStore::new();
        let mut approval_handler = MockApprovalRequester::new();
        let test_pub_key = create_stub_public_key();
        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");
        approval_handler
            .expect_request_sign_approval()
            .once()
            .returning(|_| Ok(false));
        let observer = expect_activity(|activity| {
            matches!(
                &activity.operation,
                ActivityOperation::Sign { cipher_id: Some(id), namespace: None } if id == "cipher-123"
            ) && activity.outcome == ActivityOutcome::Denied
        });

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler, observer);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(matches!(result, Ok(false)));
    }

    #[tokio::test]
    async fn test_authorize_sign_key_not_found_records_failed_activity() {
        let mut keystore = MockKeyStore::new();
        keystore.expect_get().once().returning(|_| Ok(None));
        let observer = expect_activity(|activity| {
            matches!(
                activity.operation,
                ActivityOperation::Sign {
                    cipher_id: None,
                    ..
                }
            ) && activity.outcome == ActivityOutcome::Failed
        });

        let policy =
            BitwardenAuthPolicy::new(Arc::new(keystore), MockApprovalRequester::new(), observer);

        let request = create_default_test_sign_request(create_stub_public_key());
        let result = policy.authorize(&request).await;

        assert!(matches!(result, Err(AuthError::KeyNotFound)));
    }
}
