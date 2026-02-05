use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_with::{
    base64::{Base64, Standard},
    formats::Padded,
    serde_as,
};

use crate::{BitwardenError, Callback, TimedCallback};

/// Request to get the window handle of the desktop client.
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WindowHandleQueryRequest {
    /// Marker field for parsing; data is never read.
    ///
    /// TODO: this is used to disambiguate parsing the type in desktop_napi.
    /// This will be cleaned up in PM-23485.
    window_handle: String,
}

/// Response to window handle request.
#[serde_as]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowHandleQueryResponse {
    /// Whether the desktop client is currently visible.
    pub is_visible: bool,

    /// Whether the desktop client is currently focused.
    pub is_focused: bool,

    /// Byte string representing the native OS window handle for the desktop client.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// Unused.
    ///
    /// ## Windows
    /// On Windows, this is a HWND.
    #[serde_as(as = "Base64<Standard, Padded>")]
    pub handle: Vec<u8>,
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

/// Callback to process a response to a window handle query request.
pub trait GetWindowHandleQueryCallback: Send + Sync {
    /// Function to call if a successful response is returned.
    fn on_complete(&self, response: WindowHandleQueryResponse);

    /// Function to call if an error response is returned.
    fn on_error(&self, error: BitwardenError);
}

impl GetWindowHandleQueryCallback for TimedCallback<WindowHandleQueryResponse> {
    fn on_complete(&self, response: WindowHandleQueryResponse) {
        self.send(Ok(response));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error));
    }
}
