use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::{BitwardenError, Callback, TimedCallback};

#[derive(Debug, Serialize, Deserialize)]
/// Request to retrieve the lock status of the desktop client.
pub(super) struct LockStatusRequest {}

#[derive(Debug, Deserialize)]
/// Response for the lock status of the desktop client.
pub struct LockStatusResponse {
    /// Whether the desktop client is unlocked.
    #[serde(rename = "isUnlocked")]
    pub is_unlocked: bool,
}

impl Callback for Arc<dyn GetLockStatusCallback> {
    fn complete(&self, response: serde_json::Value) -> Result<(), serde_json::Error> {
        let response = serde_json::from_value(response)?;
        self.as_ref().on_complete(response);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        self.as_ref().on_error(error);
    }
}

/// Callback to process a response to a lock status request.
pub trait GetLockStatusCallback: Send + Sync {
    /// Function to call if a successful response is returned.
    fn on_complete(&self, response: LockStatusResponse);

    /// Function to call if an error response is returned.
    fn on_error(&self, error: BitwardenError);
}

impl GetLockStatusCallback for TimedCallback<LockStatusResponse> {
    fn on_complete(&self, response: LockStatusResponse) {
        self.send(Ok(response));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error));
    }
}
