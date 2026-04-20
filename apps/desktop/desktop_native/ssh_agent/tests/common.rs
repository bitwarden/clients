//! Shared helpers for integration tests

use ssh_agent::{
    ApprovalError, ApprovalRequester, BitwardenSSHAgent, InMemoryEncryptedKeyStore,
    SignApprovalRequest,
};

pub fn init_tracing() {
    let _ = tracing_subscriber::fmt().with_test_writer().try_init();
}

pub fn always_approving_agent(
) -> BitwardenSSHAgent<InMemoryEncryptedKeyStore, MockApprovalRequester> {
    let mut requester = MockApprovalRequester::new();
    requester.expect_request_unlock().returning(|| Ok(true));
    requester
        .expect_request_sign_approval()
        .returning(|_| Ok(true));
    BitwardenSSHAgent::new(InMemoryEncryptedKeyStore::new(), requester)
}

mockall::mock! {
    pub ApprovalRequester {}

    #[async_trait::async_trait]
    impl ApprovalRequester for ApprovalRequester {
        async fn request_unlock(&self) -> Result<bool, ApprovalError>;
        async fn request_sign_approval(
            &self,
            request: SignApprovalRequest,
        ) -> Result<bool, ApprovalError>;
    }
}
