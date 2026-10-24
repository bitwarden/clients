use ap_client::CredentialData;
use wasm_bindgen::prelude::*;

/// Credential data returned from a request. Only the service worker holds this.
#[wasm_bindgen]
pub struct JsCredentialData {
    inner: CredentialData,
}

impl From<CredentialData> for JsCredentialData {
    fn from(inner: CredentialData) -> Self {
        Self { inner }
    }
}

#[wasm_bindgen]
impl JsCredentialData {
    #[wasm_bindgen(getter)]
    pub fn username(&self) -> Option<String> {
        self.inner.username.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn password(&self) -> Option<String> {
        self.inner.password.as_ref().map(|p| p.to_string())
    }

    #[wasm_bindgen(getter)]
    pub fn totp(&self) -> Option<String> {
        self.inner.totp.clone()
    }
}

/// Convert a ClientError into a JsValue for throwing.
pub fn client_error_to_js(err: ap_client::ClientError) -> JsValue {
    JsValue::from_str(&err.to_string())
}
