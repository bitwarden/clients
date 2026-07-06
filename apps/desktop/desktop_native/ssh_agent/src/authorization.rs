//! Bitwarden's auth policy for SSH agent operations.

use std::sync::Arc;

use thiserror::Error;
use tracing::{error, info};

use crate::{
    approval::{ApprovalError, ApprovalRequester, SignApprovalRequest},
    crypto::QueryableKeyData,
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
                let cipher_id = match self.keystore.get(&sign_request.public_key) {
                    Ok(Some(key_data)) => Some(key_data.cipher_id().clone()),
                    Ok(None) => {
                        return Err(AuthError::KeyNotFound);
                    }
                    Err(error) => {
                        return Err(AuthError::KeystoreError(error));
                    }
                };
                info!(
                    public_key = %sign_request.public_key,
                    is_forwarding = %sign_request.is_forwarding,
                    "Requesting sign approval."
                );

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
    use mockall::predicate::*;

    use super::*;
    use crate::{
        approval::{ApprovalError, MockApprovalRequester},
        server::SIGNamespace,
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
        process_name: Option<&str>,
        is_forwarding: bool,
        namespace: Option<SIGNamespace>,
    ) -> AuthRequest {
        AuthRequest::Sign(crate::server::SignRequest {
            public_key,
            process_name: process_name.map(std::string::ToString::to_string),
            is_forwarding,
            namespace,
            flags: None,
            host_fingerprint: None,
        })
    }

    fn create_default_test_sign_request(public_key: crate::crypto::PublicKey) -> AuthRequest {
        create_test_sign_request(
            public_key,
            Some(TEST_PROCESS_NAME),
            TEST_IS_FORWARDING,
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
    async fn test_authorize_list_initialized_keystore_allows_without_callback() {
        let mut keystore = MockKeyStore::new();
        keystore.expect_is_initialized().once().returning(|| true);
        // Approval handler must NOT be called when keystore is already initialized.
        let approval_handler = MockApprovalRequester::new();

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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

        let test_pub_key = create_stub_public_key();

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

        let test_pub_key = create_stub_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request_sign_approval()
            .withf(|req| req.cipher_id.as_deref() == Some("cipher-123"))
            .times(1)
            .returning(|_| Ok(true));

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

        let test_pub_key = create_stub_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request_sign_approval()
            .times(1)
            .returning(|_| Ok(false));

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

        let test_pub_key = create_stub_public_key();

        setup_keystore_with_key(&mut keystore, test_pub_key.clone(), "cipher-123");

        approval_handler
            .expect_request_sign_approval()
            .times(1)
            .returning(|_| Err(ApprovalError::HandlerFailed(anyhow!("Handler failed"))));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

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
                req.sign_request.process_name == Some("test-process".to_string())
                    && req.sign_request.is_forwarding
                    && req.sign_request.namespace == Some(SIGNamespace::Unsupported)
            })
            .times(1)
            .returning(|_| Ok(true));

        let policy = BitwardenAuthPolicy::new(Arc::new(keystore), approval_handler);

        let request = create_test_sign_request(
            test_pub_key,
            Some("test-process"),
            true,
            Some(SIGNamespace::Unsupported),
        );
        let result = policy.authorize(&request).await;

        assert!(matches!(result, Ok(true)), "Should pass context correctly");
    }
}
