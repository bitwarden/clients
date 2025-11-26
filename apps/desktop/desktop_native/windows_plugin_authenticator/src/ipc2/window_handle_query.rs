use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::ipc2::{BitwardenError, Callback, TimedCallback};

#[derive(Debug, Default, Serialize, Deserialize)]
pub(super) struct WindowHandleQueryRequest {
    #[serde(rename = "windowHandle")]
    window_handle: String,
}

#[derive(Debug, Deserialize)]
pub struct WindowHandleQueryResponse {
    #[serde(deserialize_with = "crate::util::deserialize_b64")]
    pub(crate) handle: Vec<u8>,
}

impl Callback for Arc<dyn GetWindowHandleQueryCallback> {
    fn complete(&self, response: serde_json::Value) -> Result<(), serde_json::Error> {
        let response = serde_json::from_value(response)?;
        self.as_ref().on_complete(response);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        self.as_ref().on_error(error);
    }
}

pub trait GetWindowHandleQueryCallback: Send + Sync {
    fn on_complete(&self, response: WindowHandleQueryResponse);
    fn on_error(&self, error: BitwardenError);
}

impl GetWindowHandleQueryCallback for TimedCallback<WindowHandleQueryResponse> {
    fn on_complete(&self, response: WindowHandleQueryResponse) {
        self.send(Ok(response));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error))
    }
}
