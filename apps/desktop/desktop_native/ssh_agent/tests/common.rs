//! Shared helpers for integration tests

use ssh_agent::{ApprovalError, ApprovalRequester, SignApprovalRequest};

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
