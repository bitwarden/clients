//! Requests to the web vault's WebAuthn connector, which makes an assertion in a browser where the
//! platform's passkey APIs can't be used, and returns the result to the app's callback URL.
//!
//! The response is encrypted with `bitwarden-web-connector`. macOS doesn't need this, since only
//! the `ASWebAuthenticationSession` receives the callback URL, but on Linux it passes through the
//! system's URL scheme handler, where other apps may see it.

use bitwarden_web_connector::{CallbackKind, Connector, PendingInitiator};
use url::Url;

use super::Error;

/// A request to the web vault's WebAuthn connector. The response is encrypted to an ephemeral key
/// that doesn't leave the request.
pub struct ConnectorRequest {
    initiator: PendingInitiator,
    url: String,
}

impl ConnectorRequest {
    /// Starts a request to the connector page at `connector_url`. `request` is sent in plaintext
    /// in the URL's fragment, but decrypting the response fails if it was modified.
    pub fn start(connector_url: &str, request: &[u8]) -> Result<Self, Error> {
        let connector_url = Url::parse(connector_url)
            .map_err(|err| Error::InvalidRequest(format!("Invalid connector URL: {err}")))?;
        let (initiator, _, url) = PendingInitiator::start(
            Connector::WebAuthnAssertion,
            CallbackKind::CustomScheme,
            &connector_url,
            request,
        )
        .map_err(|err| Error::InvalidRequest(err.to_string()))?;
        Ok(Self {
            initiator,
            url: url.into(),
        })
    }

    /// The URL to open in the browser. Its fragment has the `state` that identifies the request to
    /// [super::web_authentication_session].
    pub fn url(&self) -> &str {
        &self.url
    }

    /// Decrypts the response from the connector's callback URL.
    ///
    /// A callback for another request, or one that was modified, fails and leaves the request
    /// pending. A response can only be decrypted once. The response contains PRF outputs, which
    /// are secrets, so it must not be logged.
    pub fn decrypt_response(&mut self, callback_url: &str) -> Result<Vec<u8>, Error> {
        let callback_url = Url::parse(callback_url)
            .map_err(|_| Error::InvalidRequest("Invalid connector callback URL".to_string()))?;
        self.initiator
            .decrypt_response(&callback_url)
            .map_err(|err| Error::InvalidRequest(format!("Invalid connector response: {err}")))
    }
}

#[cfg(test)]
mod tests {
    use bitwarden_web_connector::PendingResponder;

    use super::*;

    const CONNECTOR_URL: &str = "https://vault.bitwarden.com/webauthn-desktop-connector.html";

    fn respond(request_url: &str, response: &[u8]) -> String {
        let fragment = Url::parse(request_url)
            .unwrap()
            .fragment()
            .unwrap()
            .to_owned();
        let (responder, request) =
            PendingResponder::read_request(Connector::WebAuthnAssertion, &fragment).unwrap();
        assert_eq!(request, b"options");
        responder.encrypt_response(response).unwrap().into()
    }

    #[test]
    fn test_round_trip() {
        let mut request = ConnectorRequest::start(CONNECTOR_URL, b"options").unwrap();

        assert!(request.url().starts_with(CONNECTOR_URL));
        let fragment = Url::parse(request.url())
            .unwrap()
            .fragment()
            .unwrap()
            .to_owned();
        assert!(fragment.split('&').any(|param| param.starts_with("state=")));
        let callback = respond(request.url(), b"assertion");
        assert!(callback.starts_with("bitwarden://webauthn-callback#"));
        assert_eq!(request.decrypt_response(&callback).unwrap(), b"assertion");
    }

    #[test]
    fn test_rejects_response_for_another_request() {
        let mut request = ConnectorRequest::start(CONNECTOR_URL, b"options").unwrap();
        let other = ConnectorRequest::start(CONNECTOR_URL, b"options").unwrap();

        let callback = respond(other.url(), b"assertion");
        assert!(matches!(
            request.decrypt_response(&callback),
            Err(Error::InvalidRequest(_))
        ));
    }

    #[test]
    fn test_rejects_invalid_connector_url() {
        assert!(matches!(
            ConnectorRequest::start("not a url", b"options"),
            Err(Error::InvalidRequest(_))
        ));
    }
}
