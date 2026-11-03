use win_webauthn::{
    AllowCredential, CredentialId, CtapTransport, GetAssertionRequest, PrfInputs,
    UserVerificationRequirement, WinWebAuthnError,
};
use windows::Win32::Foundation::HWND;

use super::{
    client_data, AssertionRequest, AssertionResponse, Attachment, Error, PrfValues, Transport,
    UserVerification,
};

pub(super) fn get_assertion(
    window_handle: &[u8],
    request: AssertionRequest,
) -> Result<AssertionResponse, Error> {
    let window = parse_window_handle(window_handle)?;

    // macOS sets the origin itself. On Windows, the app is responsible for the client data.
    let client_data_json = client_data::get_client_data_json(&request.challenge, &request.rp_id)?;

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
    .user_verification(match request.user_verification {
        UserVerification::Required => UserVerificationRequirement::Required,
        UserVerification::Preferred => UserVerificationRequirement::Preferred,
        UserVerification::Discouraged => UserVerificationRequirement::Discouraged,
    });
    if let Some(timeout) = request.timeout {
        builder = builder.timeout(timeout);
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

    let assertion =
        win_webauthn::get_assertion(window, &builder.build()).map_err(platform_error)?;

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
