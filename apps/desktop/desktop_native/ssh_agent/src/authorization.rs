//! Bitwarden's auth policy for SSH agent operations.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use thiserror::Error;
use tracing::{debug, error};

use crate::{
    approval::ApprovalRequester,
    crypto::{keystore::KeyStore, QueryableKeyData},
    server::{AuthPolicy, AuthRequest},
};

/// Errors that can occur during authorization of SSH agent operations.
#[derive(Debug, Error)]
pub enum AuthError {
    /// The approval handler failed to process the request.
    #[error("Approval handler failed: {0}")]
    HandlerFailed(#[source] anyhow::Error),

    /// The requested public key was not found in the keystore.
    #[error("Public key not found in keystore")]
    KeyNotFound,

    /// An error occurred while accessing the keystore.
    #[error("Keystore error: {0}")]
    KeystoreError(#[source] anyhow::Error),
}

/// Represents the vaults lock state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LockState {
    Locked,
    Unlocked,
}

/// Bitwarden's SSH operation authorization policy:
///
/// - Allows listing keys after first unlock
/// - Always requires approval for signing operations
/// - Delegates approval decisions to the provided handler
pub struct BitwardenAuthPolicy<K, H>
where
    K: KeyStore,
    H: ApprovalRequester,
{
    keystore: Arc<K>,
    approval_handler: H,
    is_locked: AtomicBool,
}

impl<K, H> BitwardenAuthPolicy<K, H>
where
    K: KeyStore,
    H: ApprovalRequester,
{
    pub fn new(keystore: Arc<K>, approval_handler: H) -> Self {
        Self {
            keystore,
            approval_handler,
            is_locked: AtomicBool::new(true),
        }
    }

    /// Sets the lock state of the vault to the provided `state`.
    ///
    /// When locked, operations will require approval.
    /// When unlocked, list operations are allowed without approval.
    pub fn set_lock_state(&self, state: LockState) {
        debug!(?state, "Setting lock state.");

        let is_locked = matches!(state, LockState::Locked);
        self.is_locked.store(is_locked, Ordering::Relaxed);
    }

    // Requests approval from the handler.
    async fn request_approval(
        &self,
        request: AuthRequest,
        cipher_id: Option<String>,
    ) -> Result<bool, AuthError> {
        debug!(?request, ?cipher_id, "Requesting approval.");

        self.approval_handler
            .request(request, cipher_id)
            .await
            .map_err(|error| {
                error!(%error, "Approval handler failed.");
                AuthError::HandlerFailed(error)
            })
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
                // If already unlocked, allow without approval
                if !self.is_locked.load(Ordering::Relaxed) {
                    debug!("Already unlocked, implicit approval for list.");
                    return Ok(true);
                }

                self.request_approval(request.clone(), None).await
            }
            AuthRequest::Sign(sign_request) => {
                // Get cipher_id
                let cipher_id = match self.keystore.get(&sign_request.public_key) {
                    Ok(Some(key_data)) => Some(key_data.cipher_id().clone()),
                    Ok(None) => {
                        return Err(AuthError::KeyNotFound);
                    }
                    Err(error) => {
                        return Err(AuthError::KeystoreError(error));
                    }
                };

                self.request_approval(request.clone(), cipher_id).await
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
        approval::MockApprovalRequester,
        crypto::{keystore::MockKeyStore, MockQueryableKeyData},
    };

    fn create_test_public_key() -> crate::crypto::PublicKey {
        crate::crypto::PublicKey {
            alg: "ssh-ed25519".to_string(),
            blob: vec![1, 2, 3],
        }
    }

    fn create_test_sign_request(
        public_key: crate::crypto::PublicKey,
        process_name: &str,
        is_forwarding: bool,
        namespace: Option<String>,
    ) -> AuthRequest {
        AuthRequest::Sign(crate::server::SignRequest {
            public_key,
            process_name: process_name.to_string(),
            is_forwarding,
            namespace,
        })
    }

    fn create_default_test_sign_request(public_key: crate::crypto::PublicKey) -> AuthRequest {
        create_test_sign_request(public_key, TEST_PROCESS_NAME, TEST_IS_FORWARDING, None)
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
    const TEST_IS_FORWARDING: bool = false;

    #[tokio::test]
    async fn test_authorize_list_when_unlocked_returns_true() {
        let keystore = Arc::new(MockKeyStore::new());
        let approval_handler = MockApprovalRequester::new();

        let policy = BitwardenAuthPolicy::new(keystore, approval_handler);
        policy.set_lock_state(LockState::Unlocked);

        let request = AuthRequest::List;
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Ok(true)),
            "Should allow list when unlocked"
        );
    }

    #[tokio::test]
    async fn test_authorize_list_when_locked_requests_approval() {
        let keystore = Arc::new(MockKeyStore::new());
        let mut approval_handler = MockApprovalRequester::new();

        // Expect approval request for List with no cipher_id
        approval_handler
            .expect_request()
            .withf(|req, cipher_id| matches!(req, AuthRequest::List) && cipher_id.is_none())
            .times(1)
            .returning(|_, _| Ok(true));

        let policy = BitwardenAuthPolicy::new(keystore, approval_handler);
        // Don't call set_unlocked - should remain locked

        let request = AuthRequest::List;
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Ok(true)),
            "Should return Ok(true) when approval granted"
        );
    }

    #[tokio::test]
    async fn test_authorize_list_when_locked_approval_denied() {
        let keystore = Arc::new(MockKeyStore::new());
        let mut approval_handler = MockApprovalRequester::new();

        approval_handler
            .expect_request()
            .times(1)
            .returning(|_, _| Ok(false));

        let policy = BitwardenAuthPolicy::new(keystore, approval_handler);

        let request = AuthRequest::List;
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Ok(false)),
            "Should return Ok(false) when approval denied"
        );
    }

    #[tokio::test]
    async fn test_authorize_list_handler_error_returns_false() {
        let keystore = Arc::new(MockKeyStore::new());
        let mut approval_handler = MockApprovalRequester::new();

        approval_handler
            .expect_request()
            .times(1)
            .returning(|_, _| Err(anyhow!("Handler failed")));

        let policy = BitwardenAuthPolicy::new(keystore, approval_handler);

        let request = AuthRequest::List;
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Err(AuthError::HandlerFailed(_))),
            "Should return HandlerFailed error"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_key_not_found() {
        let mut keystore = MockKeyStore::new();
        let approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_test_public_key();

        keystore
            .expect_get()
            .with(eq(test_pub_key.clone()))
            .times(1)
            .returning(|_| Ok(None));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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

        let test_pub_key = create_test_public_key();

        keystore
            .expect_get()
            .with(eq(test_pub_key.clone()))
            .times(1)
            .returning(|_| Err(anyhow!("Keystore error")));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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

        let test_pub_key = create_test_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request()
            .withf(|req, cipher_id| {
                matches!(req, AuthRequest::Sign(_))
                    && cipher_id.as_ref() == Some(&"cipher-123".to_string())
            })
            .times(1)
            .returning(|_, _| Ok(true));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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

        let test_pub_key = create_test_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request()
            .times(1)
            .returning(|_, _| Ok(false));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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

        let test_pub_key = create_test_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request()
            .times(1)
            .returning(|_, _| Err(anyhow!("Handler failed")));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Err(AuthError::HandlerFailed(_))),
            "Should return HandlerFailed error"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_when_unlocked_still_requires_approval() {
        let mut keystore = MockKeyStore::new();
        let mut approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_test_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request()
            .withf(|req, cipher_id| {
                matches!(req, AuthRequest::Sign(_))
                    && cipher_id.as_ref() == Some(&"cipher-123".to_string())
            })
            .times(1)
            .returning(|_, _| Ok(true));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);
        // Unlock the vault - Sign should still require approval
        policy.set_lock_state(LockState::Unlocked);

        let request = create_default_test_sign_request(test_pub_key);
        let result = policy.authorize(&request).await;

        assert!(
            matches!(result, Ok(true)),
            "Sign should always require approval, even when unlocked"
        );
    }

    #[tokio::test]
    async fn test_authorize_sign_context_passed_correctly() {
        let mut keystore = MockKeyStore::new();
        let mut approval_handler = MockApprovalRequester::new();

        let test_pub_key = create_test_public_key();

        keystore.expect_get().times(1).returning(|_| {
            let mut mock_key_data = MockQueryableKeyData::new();
            mock_key_data
                .expect_cipher_id()
                .return_const("cipher-123".to_string());
            Ok(Some(mock_key_data))
        });

        approval_handler
            .expect_request()
            .withf(|req, _cipher_id| {
                if let AuthRequest::Sign(sign_request) = req {
                    sign_request.process_name == "test-process"
                        && sign_request.is_forwarding
                        && sign_request.namespace == Some("test-namespace".to_string())
                } else {
                    false
                }
            })
            .times(1)
            .returning(|_, _| Ok(true));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

        let request = create_test_sign_request(
            test_pub_key,
            "test-process",
            true,
            Some("test-namespace".to_string()),
        );
        let result = policy.authorize(&request).await;

        assert!(matches!(result, Ok(true)), "Should pass context correctly");
    }
}
