use std::sync::Arc;

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::{Deserialize, Serialize};

use crate::{BitwardenError, Callback, TimedCallback};

/// Request to retrieve a password credential.
#[cfg_attr(feature = "napi", napi(object, namespace = "autofill"))]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordAutofillRequest {
    pub user_name: String,
    pub display_name: Option<String>,
    pub service_identifier: String,
    pub record_identifier: Option<String>,

    /// Native context required for callbacks to the OS. Format differs by OS.
    /// # Operating System Differences
    ///
    /// ## macOS
    /// A UUID representing the request.
    ///
    /// ## Windows
    /// Not implemented
    pub context: String,
}

/// Response for a password autofill request.
#[cfg_attr(feature = "napi", napi(object, namespace = "autofill"))]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordAutofillResponse {
    /// Username of the account
    pub username: String,

    pub password: String,
}

/// Callback to process a response to password autofill request.
#[cfg_attr(feature = "uniffi", uniffi::export(with_foreign))]
pub trait PreparePasswordAutofillCallback: Send + Sync {
    /// Function to call if a successful response is returned.
    fn on_complete(&self, credential: PasswordAutofillResponse);

    /// Function to call if an error response is returned.
    fn on_error(&self, error: BitwardenError);
}

impl Callback for Arc<dyn PreparePasswordAutofillCallback> {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error> {
        let credential = serde_json::from_value(credential)?;
        PreparePasswordAutofillCallback::on_complete(self.as_ref(), credential);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        PreparePasswordAutofillCallback::on_error(self.as_ref(), error);
    }
}

impl PreparePasswordAutofillCallback for TimedCallback<PasswordAutofillResponse> {
    fn on_complete(&self, credential: PasswordAutofillResponse) {
        self.send(Ok(credential));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error));
    }
}
