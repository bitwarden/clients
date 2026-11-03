use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use win_webauthn::{
    AllowCredential, CancellationId, CredentialId, CtapTransport, GetAssertionRequest, PrfInputs,
    UserVerificationRequirement, WinWebAuthnError,
};
use windows::Win32::Foundation::HWND;

use super::{
    client_data, AssertionRequest, AssertionResponse, Attachment, Error, PrfValues, Transport,
    UserVerification,
};

#[derive(Clone)]
pub(super) struct Cancellation(Arc<CancellationState>);

struct CancellationState {
    id: CancellationId,
    /// Set when cancelled, so that a cancellation before the operation starts is not lost.
    cancelled: AtomicBool,
}

impl Cancellation {
    pub(super) fn new() -> Result<Self, Error> {
        Ok(Self(Arc::new(CancellationState {
            id: CancellationId::new().map_err(platform_error)?,
            cancelled: AtomicBool::new(false),
        })))
    }

    pub(super) fn cancel(&self) {
        self.0.cancelled.store(true, Ordering::SeqCst);
        // This fails if no operation is in progress, because it has not started or has finished.
        if let Err(err) = self.0.id.cancel() {
            tracing::debug!("No WebAuthn operation to cancel: {err}");
        }
    }

    fn is_cancelled(&self) -> bool {
        self.0.cancelled.load(Ordering::SeqCst)
    }
}

pub(super) fn get_assertion(
    window_handle: &[u8],
    request: AssertionRequest,
    cancellation: &Cancellation,
) -> Result<AssertionResponse, Error> {
    let window = parse_window_handle(window_handle)?;

    // macOS sets the origin itself. On Windows, the app is responsible for the client data.
    let client_data_json =
        client_data::get_client_data_json(&request.challenge, &request.origin, &request.rp_id)?;

    let allow_credentials = request
        .allow_credentials
        .into_iter()
        .map(|c| {
            Ok(AllowCredential {
                id: CredentialId::try_from(c.id)
                    .map_err(|err| Error::InvalidRequest(err.to_string()))?,
                transports: c.transports.into_iter().map(ctap_transport).collect(),
            })
        })
        .collect::<Result<Vec<_>, Error>>()?;

    let mut builder = GetAssertionRequest::builder(
        win_webauthn::api_version().map_err(platform_error)?,
        request.rp_id,
        client_data_json.clone(),
    )
    .allow_credentials(allow_credentials)
    .cancellation_id(cancellation.0.id)
    .user_verification(match request.user_verification {
        UserVerification::Required => UserVerificationRequirement::Required,
        UserVerification::Preferred => UserVerificationRequirement::Preferred,
        UserVerification::Discouraged => UserVerificationRequirement::Discouraged,
    });
    if let Some(timeout) = request.timeout {
        builder = builder.timeout(timeout);
    }
    if let Some(app_id) = request.app_id {
        client_data::validate_app_id(&app_id, &request.origin)?;
        builder = builder.u2f_app_id(app_id);
    }
    if let Some(prf) = request.prf {
        // Passkeys without PRF can still be used to sign in, so PRF is optional.
        builder = builder.prefer_prf(PrfInputs {
            eval: Some(win_webauthn::PrfValues {
                first: prf.first,
                second: prf.second,
            }),
            eval_by_credential: Vec::new(),
        });
    }

    if cancellation.is_cancelled() {
        return Err(Error::Cancelled);
    }
    let assertion = win_webauthn::get_assertion(window, &builder.build()).map_err(|err| {
        if cancellation.is_cancelled() {
            Error::Cancelled
        } else {
            platform_error(err)
        }
    })?;

    Ok(AssertionResponse {
        credential_id: assertion.credential_id().to_vec(),
        // Newer versions of webauthn.dll return the client data that was signed. It should be
        // what was passed in, but prefer what Windows reports.
        client_data_json: assertion
            .client_data_json()
            .map_or(client_data_json, <[u8]>::to_vec),
        authenticator_data: assertion.authenticator_data().to_vec(),
        signature: assertion.signature().to_vec(),
        user_handle: assertion.user_handle().map(<[u8]>::to_vec),
        attachment: assertion.used_transport().map(|t| match t {
            CtapTransport::Internal => Attachment::Platform,
            _ => Attachment::CrossPlatform,
        }),
        prf: assertion.prf_results().map(|results| PrfValues {
            first: results.first.to_vec(),
            second: results.second.map(<[u8]>::to_vec),
        }),
        app_id_used: assertion.u2f_app_id_used(),
    })
}

/// Converts the buffer from Electron's `getNativeWindowHandle()`, which holds an `HWND` in
/// native byte order.
fn parse_window_handle(window_handle: &[u8]) -> Result<HWND, Error> {
    let bytes = window_handle.try_into().map_err(|_| {
        Error::InvalidRequest(format!(
            "window handle must be {} bytes, received {}",
            size_of::<usize>(),
            window_handle.len()
        ))
    })?;
    Ok(HWND(usize::from_ne_bytes(bytes) as *mut _))
}

fn ctap_transport(transport: Transport) -> CtapTransport {
    match transport {
        Transport::Usb => CtapTransport::Usb,
        Transport::Nfc => CtapTransport::Nfc,
        Transport::Ble => CtapTransport::Ble,
        Transport::SmartCard => CtapTransport::SmartCard,
        Transport::Hybrid => CtapTransport::Hybrid,
        Transport::Internal => CtapTransport::Internal,
    }
}

fn platform_error(err: WinWebAuthnError) -> Error {
    Error::Platform {
        dom_error_name: err.dom_error_name().map(str::to_string),
        message: err.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_window_handle() {
        let hwnd = parse_window_handle(&0x1234usize.to_ne_bytes()).unwrap();
        assert_eq!(hwnd.0 as usize, 0x1234);
    }

    #[test]
    fn test_parse_window_handle_rejects_wrong_length() {
        assert!(parse_window_handle(&[1, 2, 3]).is_err());
    }
}
