#[napi]
pub mod webauthn {
    use std::time::Duration;

    use desktop_core::webauthn as core;
    use napi::bindgen_prelude::Uint8Array;

    /// Corresponds to WebAuthn's `PublicKeyCredentialRequestOptions`, with `BufferSource`s as
    /// bytes.
    #[napi(object)]
    pub struct AssertionRequest {
        /// The origin making the request, e.g. `https://vault.bitwarden.com`.
        pub origin: String,
        pub rp_id: String,
        pub challenge: Uint8Array,
        /// Credentials with a type other than `public-key` must be removed by the caller.
        pub allow_credentials: Vec<CredentialDescriptor>,
        /// `required`, `preferred` or `discouraged`. Unknown values are treated as `preferred`.
        pub user_verification: Option<String>,
        /// In milliseconds.
        pub timeout: Option<u32>,
        /// PRF extension `eval` inputs.
        pub prf: Option<PrfValues>,
        /// The `appid` extension input.
        pub app_id: Option<String>,
    }

    #[napi(object)]
    pub struct CredentialDescriptor {
        pub id: Uint8Array,
        /// Unknown values are ignored.
        pub transports: Option<Vec<String>>,
    }

    /// PRF extension inputs or outputs. These are secrets and must not be logged.
    #[napi(object)]
    pub struct PrfValues {
        pub first: Uint8Array,
        pub second: Option<Uint8Array>,
    }

    /// The fields of a WebAuthn `PublicKeyCredential` with an `AuthenticatorAssertionResponse`.
    #[napi(object)]
    pub struct AssertionResponse {
        pub credential_id: Uint8Array,
        pub client_data_json: Uint8Array,
        pub authenticator_data: Uint8Array,
        pub signature: Uint8Array,
        pub user_handle: Option<Uint8Array>,
        /// `platform` or `cross-platform`.
        pub authenticator_attachment: Option<String>,
        /// PRF outputs, if PRF was requested and the authenticator returned results.
        pub prf: Option<PrfValues>,
        /// The `appid` extension output, if an app ID was requested.
        pub app_id_used: Option<bool>,
    }

    /// An error to be thrown as a `DOMException` with this name and message.
    #[napi(object)]
    pub struct WebAuthnError {
        pub name: String,
        pub message: String,
    }

    /// Exactly one of `response`, `error` and `requiresBrowser` is set.
    #[napi(object)]
    pub struct GetAssertionResult {
        pub response: Option<AssertionResponse>,
        pub error: Option<WebAuthnError>,
        /// Set when the platform's passkey APIs can't be used for the request, e.g. because the
        /// RP ID is not in the app's associated domains on macOS. Retry it in a browser with
        /// `webAuthenticationSession`.
        pub requires_browser: Option<bool>,
    }

    /// The result of a `webAuthenticationSession` call. Exactly one of `callbackUrl` and `error`
    /// is set.
    #[napi(object)]
    pub struct WebAuthenticationSessionResult {
        /// The URL the page navigated to, which ended the session.
        pub callback_url: Option<String>,
        pub error: Option<WebAuthnError>,
    }

    /// Cancels a single `getAssertion` or `webAuthenticationSession` call.
    #[napi]
    pub struct AssertionCancellation {
        inner: core::Cancellation,
    }

    #[napi]
    impl AssertionCancellation {
        #[napi(constructor)]
        pub fn new() -> napi::Result<Self> {
            let inner = core::Cancellation::new()
                .map_err(|err| napi::Error::from_reason(err.to_string()))?;
            Ok(Self { inner })
        }

        /// Closes the platform's prompt or browser session. The call returns an `AbortError`.
        #[napi]
        pub fn cancel(&self) {
            self.inner.cancel();
        }
    }

    /// Requests a WebAuthn assertion from the platform's passkey APIs, showing the platform's
    /// prompt modal to the window.
    ///
    /// Failures of the WebAuthn operation, including the user cancelling, are returned in
    /// `GetAssertionResult.error` rather than thrown, so that the `DOMException` name is
    /// preserved.
    #[napi]
    pub async fn get_assertion(
        window_handle: Uint8Array,
        request: AssertionRequest,
        cancellation: &AssertionCancellation,
    ) -> napi::Result<GetAssertionResult> {
        let window_handle = window_handle.to_vec();
        let request = core_request(request);
        let cancellation = cancellation.inner.clone();
        let result = tokio::task::spawn_blocking(move || {
            core::get_assertion(&window_handle, request, &cancellation)
        })
        .await
        .map_err(|err| napi::Error::from_reason(format!("WebAuthn task failed: {err}")))?;
        Ok(match result {
            Ok(response) => GetAssertionResult {
                response: Some(napi_response(response)),
                error: None,
                requires_browser: None,
            },
            Err(core::Error::RequiresBrowser(_)) => GetAssertionResult {
                response: None,
                error: None,
                requires_browser: Some(true),
            },
            Err(err) => GetAssertionResult {
                response: None,
                error: Some(WebAuthnError {
                    name: err.dom_error_name().to_string(),
                    message: err.to_string(),
                }),
                requires_browser: None,
            },
        })
    }

    /// Whether the platform's passkey APIs can't be used for the RP ID, so the assertion must be
    /// made in a browser with `webAuthenticationSession` instead of with `getAssertion`. On macOS,
    /// the passkey APIs can only be used for relying parties in the app's associated domains.
    #[napi]
    pub fn requires_browser(rp_id: String) -> bool {
        core::requires_browser(&rp_id)
    }

    /// Opens `url` in a browser session presented from the window, and resolves with the URL
    /// that the page navigates to with the scheme `callbackScheme`, which ends the session. Only
    /// this caller receives that URL, rather than the app's URL scheme handler. The session does
    /// not share cookies or other browsing data with the user's browser.
    ///
    /// Only implemented on macOS. Failures, including the user closing the session, are returned
    /// in `WebAuthenticationSessionResult.error` rather than thrown.
    #[napi]
    pub async fn web_authentication_session(
        window_handle: Uint8Array,
        url: String,
        callback_scheme: String,
        cancellation: &AssertionCancellation,
    ) -> napi::Result<WebAuthenticationSessionResult> {
        let window_handle = window_handle.to_vec();
        let cancellation = cancellation.inner.clone();
        let result = tokio::task::spawn_blocking(move || {
            core::web_authentication_session(&window_handle, &url, &callback_scheme, &cancellation)
        })
        .await
        .map_err(|err| napi::Error::from_reason(format!("WebAuthn task failed: {err}")))?;
        Ok(match result {
            Ok(callback_url) => WebAuthenticationSessionResult {
                callback_url: Some(callback_url),
                error: None,
            },
            Err(err) => WebAuthenticationSessionResult {
                callback_url: None,
                error: Some(WebAuthnError {
                    name: err.dom_error_name().to_string(),
                    message: err.to_string(),
                }),
            },
        })
    }

    /// A request to the web vault's WebAuthn connector. Its response is encrypted to an ephemeral
    /// key that doesn't leave the native module.
    #[napi]
    pub struct WebConnectorRequest {
        inner: core::ConnectorRequest,
    }

    #[napi]
    impl WebConnectorRequest {
        /// Starts a request to the connector page at `connectorUrl`. `request` is sent in
        /// plaintext in the URL's fragment, but decrypting the response fails if it was modified.
        #[napi(factory)]
        pub fn start(connector_url: String, request: Uint8Array) -> napi::Result<Self> {
            let inner = core::ConnectorRequest::start(&connector_url, &request)
                .map_err(|err| napi::Error::from_reason(err.to_string()))?;
            Ok(Self { inner })
        }

        /// The URL to open with `webAuthenticationSession`. Its fragment has the `state` that
        /// identifies the request.
        #[napi(getter)]
        pub fn url(&self) -> String {
            self.inner.url().to_string()
        }

        /// Decrypts the response from the connector's callback URL. A callback for another
        /// request, or one that was modified, throws and leaves the request pending. A response
        /// can only be decrypted once. It contains PRF outputs, which must not be logged.
        #[napi]
        pub fn decrypt_response(&mut self, callback_url: String) -> napi::Result<Uint8Array> {
            self.inner
                .decrypt_response(&callback_url)
                .map(Into::into)
                .map_err(|err| napi::Error::from_reason(err.to_string()))
        }
    }

    fn core_request(request: AssertionRequest) -> core::AssertionRequest {
        core::AssertionRequest {
            origin: request.origin,
            rp_id: request.rp_id,
            challenge: request.challenge.to_vec(),
            allow_credentials: request
                .allow_credentials
                .into_iter()
                .map(|c| core::CredentialDescriptor {
                    id: c.id.to_vec(),
                    transports: c
                        .transports
                        .unwrap_or_default()
                        .iter()
                        .filter_map(|t| transport(t))
                        .collect(),
                })
                .collect(),
            user_verification: match request.user_verification.as_deref() {
                Some("required") => core::UserVerification::Required,
                Some("discouraged") => core::UserVerification::Discouraged,
                _ => core::UserVerification::Preferred,
            },
            timeout: request.timeout.map(|ms| Duration::from_millis(ms.into())),
            prf: request.prf.map(|prf| core::PrfValues {
                first: prf.first.to_vec(),
                second: prf.second.map(|s| s.to_vec()),
            }),
            app_id: request.app_id,
        }
    }

    fn transport(transport: &str) -> Option<core::Transport> {
        match transport {
            "usb" => Some(core::Transport::Usb),
            "nfc" => Some(core::Transport::Nfc),
            "ble" => Some(core::Transport::Ble),
            "smart-card" => Some(core::Transport::SmartCard),
            "hybrid" => Some(core::Transport::Hybrid),
            "internal" => Some(core::Transport::Internal),
            _ => None,
        }
    }

    fn napi_response(response: core::AssertionResponse) -> AssertionResponse {
        AssertionResponse {
            credential_id: response.credential_id.into(),
            client_data_json: response.client_data_json.into(),
            authenticator_data: response.authenticator_data.into(),
            signature: response.signature.into(),
            user_handle: response.user_handle.map(Into::into),
            authenticator_attachment: response.attachment.map(|a| {
                match a {
                    core::Attachment::Platform => "platform",
                    core::Attachment::CrossPlatform => "cross-platform",
                }
                .to_string()
            }),
            prf: response.prf.map(|prf| PrfValues {
                first: prf.first.into(),
                second: prf.second.map(Into::into),
            }),
            app_id_used: response.app_id_used,
        }
    }
}
