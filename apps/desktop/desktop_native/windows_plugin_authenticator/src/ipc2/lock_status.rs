use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::ipc2::{BitwardenError, Callback, TimedCallback};

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct LockStatusRequest {}

#[derive(Debug, Deserialize)]
pub struct LockStatusResponse {
    #[serde(rename = "isUnlocked")]
    pub(crate) is_unlocked: bool,
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

pub trait GetLockStatusCallback: Send + Sync {
    fn on_complete(&self, response: LockStatusResponse);
    fn on_error(&self, error: BitwardenError);
}

impl GetLockStatusCallback for TimedCallback<LockStatusResponse> {
    fn on_complete(&self, response: LockStatusResponse) {
        self.send(Ok(response));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error))
    }
}
