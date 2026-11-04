use std::{
    ffi::c_void,
    ptr::NonNull,
    sync::{Arc, Mutex, MutexGuard},
};

use desktop_objc::webauthn::{
    self as objc, as_authorization_error, AssertionCanceller, AssertionError,
    SecurityKeyTransports, AS_AUTHORIZATION_ERROR_DOMAIN,
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
    canceller: Option<AssertionCanceller>,
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

    // macOS creates the client data itself, with an origin of `https://<rpId>`, so the origin is
    // only used to check that the request is one the web vault could make.
    client_data::validate_rp_id_for_origin(&request.rp_id, &request.origin)?;
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

    let pending = {
        // Start while holding the lock, so that a concurrent cancellation is either seen here or
        // cancels the started operation.
        let mut state = cancellation.lock();
        if state.cancelled {
            return Err(Error::Cancelled);
        }
        // SAFETY: The caller passes the handle of an open window, which is an NSView pointer.
        let pending =
            unsafe { objc::get_assertion(view, &objc_request) }.map_err(platform_error)?;
        state.canceller = Some(pending.canceller());
        pending
    };
    let result = pending.wait();
    cancellation.lock().canceller = None;
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
        AssertionError::NotSupported(message) => Error::Platform {
            message,
            dom_error_name: Some("NotSupportedError".to_string()),
        },
        AssertionError::InvalidRequest(message) => Error::Platform {
            message,
            dom_error_name: Some("InvalidStateError".to_string()),
        },
        AssertionError::Authorization {
            domain,
            code,
            message,
        } => {
            if domain == AS_AUTHORIZATION_ERROR_DOMAIN && code == as_authorization_error::FAILED {
                // Adapted from MaybeLogUnconfiguredError in Electron's
                // electron_platform_passkeys_authenticator_mac.mm.
                tracing::warn!(
                    "Passkey request failed (ASAuthorizationError 1004). This usually means the \
                     app isn't signed with the associated-domains entitlement, or the relying \
                     party's domain isn't serving a valid .well-known/apple-app-site-association \
                     with a \"webcredentials\" entry for this app."
                );
            }
            // As in browsers, every failure, including the user cancelling, is a NotAllowedError
            // so that RPs can't distinguish them.
            Error::Platform {
                message: format!("{message} ({domain} {code})"),
                dom_error_name: Some("NotAllowedError".to_string()),
            }
        }
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
