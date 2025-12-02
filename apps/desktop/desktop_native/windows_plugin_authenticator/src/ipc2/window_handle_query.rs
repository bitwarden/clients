use std::sync::Arc;

use serde::{Deserialize, Serialize};
use windows::Win32::Foundation::HWND;

use crate::{
    ipc2::{BitwardenError, Callback, TimedCallback},
    WindowDetails,
};

#[derive(Debug, Default, Serialize, Deserialize)]
pub(super) struct WindowHandleQueryRequest {
    #[serde(rename = "windowHandle")]
    window_handle: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowHandleQueryResponse {
    pub(crate) is_visible: bool,
    pub(crate) is_focused: bool,
    #[serde(deserialize_with = "crate::util::deserialize_b64")]
    pub(crate) handle: Vec<u8>,
}

impl TryFrom<WindowHandleQueryResponse> for WindowDetails {
    type Error = String;

    fn try_from(value: WindowHandleQueryResponse) -> Result<Self, Self::Error> {
        unsafe {
            // SAFETY: We check to make sure that the vec is the expected size
            // before converting it. If the handle is invalid when passed to
            // Windows, the request will be rejected.
            let handle = if value.handle.len() == size_of::<HWND>() {
                *value.handle.as_ptr().cast()
            } else {
                return Err(format!(
                    "Invalid window handle received: {:?}",
                    value.handle
                ));
            };
            Ok(Self {
                is_visible: value.is_visible,
                is_focused: value.is_focused,
                handle,
            })
        }
    }
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
