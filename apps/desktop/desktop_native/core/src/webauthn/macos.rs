use std::{
    ffi::c_void,
    ptr::NonNull,
    sync::{Arc, Mutex, MutexGuard},
};

use desktop_objc::{
    web_authentication_session::{self as web_session, SessionError},
    webauthn::{
        self as objc, as_authorization_error, AssertionError, SecurityKeyTransports,
        AS_AUTHORIZATION_ERROR_DOMAIN,
    },
    OperationCanceller,
};

use super::{
    client_data, AssertionRequest, AssertionResponse, Attachment, Error, PrfValues, Transport,
    UserVerification,
};

#[derive(Clone)]
pub(super) struct Cancellation(Arc<Mutex<CancellationState>>);

#[derive(Default)]
struct CancellationState {
    /// Set when cancelled, so that a cancellation before the operation starts is not lost.
    cancelled: bool,
    /// Set while an operation is in progress.
    canceller: Option<OperationCanceller>,
}

impl Cancellation {
    pub(super) fn new() -> Result<Self, Error> {
        Ok(Self(Arc::default()))
    }

    pub(super) fn cancel(&self) {
        let mut state = self.lock();
        state.cancelled = true;
        if let Some(canceller) = state.canceller.take() {
            canceller.cancel();
        }
    }

    /// Starts an operation while holding the lock, so that a concurrent cancellation is either
    /// seen here or cancels the started operation.
    fn start<P>(
        &self,
        start: impl FnOnce() -> Result<P, Error>,
        canceller: impl FnOnce(&P) -> OperationCanceller,
    ) -> Result<P, Error> {
        let mut state = self.lock();
        if state.cancelled {
            return Err(Error::Cancelled);
        }
        let pending = start()?;
        state.canceller = Some(canceller(&pending));
        Ok(pending)
    }

    /// Releases the operation once it has completed.
    fn finish(&self) {
        self.lock().canceller = None;
    }

    fn is_cancelled(&self) -> bool {
        self.lock().cancelled
    }

    fn lock(&self) -> MutexGuard<'_, CancellationState> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

pub(super) fn get_assertion(
    window_handle: &[u8],
    request: AssertionRequest,
    cancellation: &Cancellation,
) -> Result<AssertionResponse, Error> {
    let view = parse_window_handle(window_handle)?;

    // macOS creates the client data itself, with an origin of `https://<rpId>`, so the request's
    // origin is only checked: that the request is one the web vault could make, and that the
    // platform's client data will have the same origin.
    client_data::validate_rp_id_for_origin(&request.rp_id, &request.origin)?;
    // The RP would reject client data with an origin other than the request's, e.g. when the web
    // vault is on another port or on a subdomain of the RP ID. A browser uses the request's origin.
    if !is_platform_origin(&request.origin, &request.rp_id) {
        return Err(Error::RequiresBrowser(format!(
            "The platform would use the origin https://{} instead of {}",
            request.rp_id, request.origin
        )));
    }
    if let Some(app_id) = &request.app_id {
        client_data::validate_app_id(app_id, &request.origin)?;
    }

    let allow_credentials: Vec<_> = request
        .allow_credentials
        .iter()
        .map(|c| objc::CredentialDescriptor {
            id: &c.id,
            transports: security_key_transports(&c.transports),
        })
        .collect();
    // There is no timeout: the system prompt stays open until the user dismisses it.
    let objc_request = objc::AssertionRequest {
        rp_id: &request.rp_id,
        challenge: &request.challenge,
        allow_credentials: &allow_credentials,
        user_verification: match request.user_verification {
            UserVerification::Required => objc::UserVerification::Required,
            UserVerification::Preferred => objc::UserVerification::Preferred,
            UserVerification::Discouraged => objc::UserVerification::Discouraged,
        },
        // Passkeys without PRF can still be used to sign in, so PRF is optional.
        prf: request.prf.as_ref().map(|prf| objc::PrfValues {
            first: &prf.first,
            second: prf.second.as_deref(),
        }),
        app_id: request.app_id.as_deref(),
    };

    let pending = cancellation.start(
        // SAFETY: The caller passes the handle of an open window, which is an NSView pointer.
        || unsafe { objc::get_assertion(view, &objc_request) }.map_err(platform_error),
        objc::PendingAssertion::canceller,
    )?;
    let result = pending.wait();
    cancellation.finish();
    let assertion = result.map_err(|err| {
        if cancellation.is_cancelled() {
            Error::Cancelled
        } else {
            platform_error(err)
        }
    })?;

    // Apple's client data is what was signed, so it must be returned for the RP to verify the
    // assertion. Check that it is for this request rather than return unexpected bytes.
    client_data::validate_platform_client_data_json(
        &assertion.client_data_json,
        &request.challenge,
        &request.rp_id,
    )?;

    Ok(AssertionResponse {
        credential_id: assertion.credential_id,
        client_data_json: assertion.client_data_json,
        authenticator_data: assertion.authenticator_data,
        signature: assertion.signature,
        user_handle: assertion.user_handle,
        attachment: assertion.attachment.map(|a| match a {
            objc::Attachment::Platform => Attachment::Platform,
            objc::Attachment::CrossPlatform => Attachment::CrossPlatform,
        }),
        prf: assertion.prf.map(|prf| PrfValues {
            first: prf.first,
            second: prf.second,
        }),
        app_id_used: assertion.app_id_used,
    })
}

pub(super) fn requires_browser(rp_id: &str) -> bool {
    !is_associated_domain(rp_id, &web_session::web_credentials_associated_domains())
}

pub(super) fn web_authentication_session(
    window_handle: &[u8],
    url: &str,
    callback_scheme: &str,
    cancellation: &Cancellation,
) -> Result<String, Error> {
    let view = parse_window_handle(window_handle)?;
    let pending = cancellation.start(
        // SAFETY: The caller passes the handle of an open window, which is an NSView pointer.
        // The session is ephemeral, so that nothing from it, such as the callback URL, is kept
        // in the user's browser.
        || unsafe { web_session::start(view, url, callback_scheme, true) }.map_err(session_error),
        web_session::PendingSession::canceller,
    )?;
    let result = pending.wait();
    cancellation.finish();
    result.map_err(|err| {
        if cancellation.is_cancelled() {
            Error::Cancelled
        } else {
            session_error(err)
        }
    })
}

/// Whether `origin` is the origin that macOS puts in the client data for `rp_id`, which is
/// `https://<rpId>`.
fn is_platform_origin(origin: &str, rp_id: &str) -> bool {
    origin.eq_ignore_ascii_case(&format!("https://{rp_id}"))
}

/// Whether the system allows the platform passkey APIs for `rp_id`, given the app's
/// `webcredentials:` associated domains. The domain must also serve an
/// `apple-app-site-association` file that lists the app, which is not checked.
///
/// A wildcard such as `*.example.com` is only treated as covering direct subdomains like
/// `vault.example.com`. Treating a domain as uncovered only means that the browser is used.
fn is_associated_domain(rp_id: &str, associated_domains: &[String]) -> bool {
    let rp_id = rp_id.to_ascii_lowercase();
    associated_domains.iter().any(|entry| {
        // Strip a `?mode=developer` or `?mode=managed` suffix.
        let domain = entry
            .split('?')
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase();
        match domain.strip_prefix("*.") {
            Some(parent) => rp_id
                .strip_suffix(parent)
                .and_then(|subdomain| subdomain.strip_suffix('.'))
                .is_some_and(|label| !label.is_empty() && !label.contains('.')),
            None => rp_id == domain,
        }
    })
}

/// Converts the buffer from Electron's `getNativeWindowHandle()`, which holds an `NSView *` in
/// native byte order.
fn parse_window_handle(window_handle: &[u8]) -> Result<NonNull<c_void>, Error> {
    let bytes = window_handle.try_into().map_err(|_| {
        Error::InvalidRequest(format!(
            "window handle must be {} bytes, received {}",
            size_of::<usize>(),
            window_handle.len()
        ))
    })?;
    NonNull::new(usize::from_ne_bytes(bytes) as *mut c_void)
        .ok_or_else(|| Error::InvalidRequest("window handle is null".to_string()))
}

/// Credentials that do not list transports may be on a security key reachable by any transport.
fn security_key_transports(transports: &[Transport]) -> SecurityKeyTransports {
    if transports.is_empty() {
        return SecurityKeyTransports::ALL_SUPPORTED;
    }
    let mut result = SecurityKeyTransports::default();
    for transport in transports {
        result |= match transport {
            Transport::Usb => SecurityKeyTransports::USB,
            Transport::Nfc => SecurityKeyTransports::NFC,
            Transport::Ble => SecurityKeyTransports::BLE,
            Transport::SmartCard | Transport::Hybrid | Transport::Internal => continue,
        };
    }
    result
}

fn platform_error(err: AssertionError) -> Error {
    match err {
        // macOS 12, which does not have the passkey APIs this uses.
        AssertionError::NotSupported(message) => Error::RequiresBrowser(message),
        AssertionError::InvalidRequest(message) => Error::Platform {
            message,
            dom_error_name: Some("InvalidStateError".to_string()),
        },
        AssertionError::Authorization {
            domain,
            code,
            message,
        } if domain == AS_AUTHORIZATION_ERROR_DOMAIN && code == as_authorization_error::FAILED => {
            // Adapted from MaybeLogUnconfiguredError in Electron's
            // electron_platform_passkeys_authenticator_mac.mm.
            tracing::warn!(
                "Passkey request failed (ASAuthorizationError 1004), so it will be retried in a \
                 browser. This usually means the app isn't signed with the associated-domains \
                 entitlement, or the relying party's domain isn't serving a valid \
                 .well-known/apple-app-site-association with a \"webcredentials\" entry for \
                 this app."
            );
            Error::RequiresBrowser(format!("{message} ({domain} {code})"))
        }
        AssertionError::Authorization {
            domain,
            code,
            message,
        } => {
            // As in browsers, every failure, including the user cancelling, is a NotAllowedError
            // so that RPs can't distinguish them.
            Error::Platform {
                message: format!("{message} ({domain} {code})"),
                dom_error_name: Some("NotAllowedError".to_string()),
            }
        }
    }
}

fn session_error(err: SessionError) -> Error {
    match err {
        SessionError::InvalidRequest(message) => Error::Platform {
            message,
            dom_error_name: Some("InvalidStateError".to_string()),
        },
        SessionError::Session {
            domain,
            code,
            message,
        } => Error::Platform {
            message: format!("{message} ({domain} {code})"),
            dom_error_name: Some("NotAllowedError".to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_window_handle() {
        let view = parse_window_handle(&0x1234usize.to_ne_bytes()).unwrap();
        assert_eq!(view.as_ptr() as usize, 0x1234);
    }

    #[test]
    fn test_parse_window_handle_rejects_wrong_length() {
        assert!(parse_window_handle(&[1, 2, 3]).is_err());
    }

    #[test]
    fn test_parse_window_handle_rejects_null() {
        assert!(parse_window_handle(&0usize.to_ne_bytes()).is_err());
    }

    #[test]
    fn test_is_associated_domain() {
        let domains = [
            "example.com".to_string(),
            "*.example.com".to_string(),
            "dev.test?mode=developer".to_string(),
        ];
        for rp_id in [
            "example.com",
            "vault.example.com",
            "Vault.Example.com",
            "dev.test",
        ] {
            assert!(is_associated_domain(rp_id, &domains), "{rp_id}");
        }
        for rp_id in [
            "a.vault.example.com",
            "notexample.com",
            "example.com.evil.com",
            "test",
            "vault.dev.test",
            "",
        ] {
            assert!(!is_associated_domain(rp_id, &domains), "{rp_id}");
        }
    }

    #[test]
    fn test_is_platform_origin() {
        assert!(is_platform_origin(
            "https://vault.example.com",
            "vault.example.com"
        ));
        assert!(is_platform_origin(
            "https://Vault.Example.com",
            "vault.example.com"
        ));
        assert!(!is_platform_origin(
            "https://vault.example.com:8080",
            "vault.example.com"
        ));
        assert!(!is_platform_origin(
            "https://vault.example.com",
            "example.com"
        ));
        assert!(!is_platform_origin("http://localhost", "localhost"));
    }

    #[test]
    fn test_wildcard_does_not_cover_parent_domain() {
        assert!(!is_associated_domain(
            "example.com",
            &["*.example.com".to_string()]
        ));
    }

    #[test]
    fn test_security_key_transports() {
        assert_eq!(
            security_key_transports(&[]),
            SecurityKeyTransports::ALL_SUPPORTED
        );
        assert_eq!(
            security_key_transports(&[Transport::Usb, Transport::Nfc, Transport::Internal]),
            SecurityKeyTransports::USB | SecurityKeyTransports::NFC
        );
        assert_eq!(
            security_key_transports(&[Transport::Internal, Transport::Hybrid]),
            SecurityKeyTransports::default()
        );
    }
}
