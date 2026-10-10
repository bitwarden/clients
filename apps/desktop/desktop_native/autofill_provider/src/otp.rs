use std::sync::Arc;

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::{Deserialize, Serialize};

use crate::{BitwardenError, Callback, TimedCallback, WindowDetails};

/// Request to retrieve a one-time code credential.
#[cfg_attr(feature = "napi", napi(object, namespace = "autofill"))]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpAutofillRequest {
    /// User the OS already picked, when the request came from a suggestion.
    /// Absent when the user asked to browse their credentials instead.
    pub user_name: Option<String>,

    pub display_name: Option<String>,

    /// The services a credential is being requested for, most specific first
    /// (e.g. `["m.example.com", "example.com"]`). May be empty, which asks for
    /// every credential the user could fill.
    pub service_identifiers: Vec<String>,

    /// Identifier of the credential the OS already picked, when the request came
    /// from a suggestion. Absent when the user asked to browse their
    /// credentials instead, in which case a picker has to be shown.
    pub record_identifier: Option<String>,

    /// Details about the window of the application requesting the code.
    pub client_window: WindowDetails,

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

/// Response for a one-time code autofill request.
#[cfg_attr(feature = "napi", napi(object, namespace = "autofill"))]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpAutofillResponse {
    pub code: String,
}

/// Callback to process a response to one-time code autofill request.
#[cfg_attr(feature = "uniffi", uniffi::export(with_foreign))]
pub trait PrepareOtpAutofillCallback: Send + Sync {
    /// Function to call if a successful response is returned.
    fn on_complete(&self, credential: OtpAutofillResponse);

    /// Function to call if an error response is returned.
    fn on_error(&self, error: BitwardenError);
}

impl Callback for Arc<dyn PrepareOtpAutofillCallback> {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error> {
        let credential = serde_json::from_value(credential)?;
        PrepareOtpAutofillCallback::on_complete(self.as_ref(), credential);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        PrepareOtpAutofillCallback::on_error(self.as_ref(), error);
    }
}

impl PrepareOtpAutofillCallback for TimedCallback<OtpAutofillResponse> {
    fn on_complete(&self, credential: OtpAutofillResponse) {
        self.send(Ok(credential));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error));
    }
}
