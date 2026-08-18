use std::ffi::c_void;

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_with::{
    base64::{Base64, Standard},
    formats::Padded,
    serde_as,
};
use win_webauthn::plugin::{PluginUserVerificationRequest, WebAuthnPlugin};
use windows::Win32::Foundation::HWND;

use super::{get_clsid, parse_context_string, CommandResponse};

pub(super) fn handle_user_verification_request(
    request: UserVerificationParameters,
) -> Result<UserVerificationResponse> {
    // The request carries the username of the credential in use, so it is not
    // logged here.
    tracing::debug!("Handling user verification request");

    let Some(clsid) = get_clsid()? else {
        return Err(anyhow!("[core::autofill::user_verification] UV requested, but no CLSID was found. Skipping request."));
    };

    let (transaction_id, operation_request_hash) =
        parse_context_string(&request.transaction_context)
            .context("Failed to parse transaction context")?;

    let uv_request = PluginUserVerificationRequest {
        window_handle: parse_window_handle(&request.window_handle)?,
        transaction_id,
        user_name: request.username,
        display_hint: Some(request.display_hint),
    };

    let plugin = WebAuthnPlugin::new(clsid);
    match plugin.perform_user_verification(uv_request, &operation_request_hash) {
        Ok(()) => Ok(UserVerificationResponse {
            outcome: UserVerificationOutcome::Verified,
        }),
        // Dismissing the Windows Hello prompt is an answer, not a failure, so
        // it is reported as an outcome the caller can act on rather than an
        // error indistinguishable from a broken request.
        Err(err) if err.is_user_cancelled() => Ok(UserVerificationResponse {
            outcome: UserVerificationOutcome::Cancelled,
        }),
        Err(err) => Err(anyhow::Error::new(err).context("User verification request failed")),
    }
}

/// Rebuilds a window handle from the raw bytes of Electron's
/// `getNativeWindowHandle()` buffer.
///
/// Only the length is checked: if the handle is invalid when passed to Windows,
/// the request is rejected by the OS.
fn parse_window_handle(bytes: &[u8]) -> Result<HWND> {
    let handle: [u8; size_of::<usize>()] = bytes.try_into().map_err(|_| {
        anyhow!(
            "Invalid window handle: expected {} bytes, got {}",
            size_of::<usize>(),
            bytes.len()
        )
    })?;

    Ok(HWND(usize::from_le_bytes(handle) as *mut c_void))
}

#[serde_as]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct UserVerificationParameters {
    /// Raw bytes of the handle of the window the prompt should attach to.
    #[serde_as(as = "Base64<Standard, Padded>")]
    window_handle: Vec<u8>,

    /// Opaque context binding this prompt to the WebAuthn operation that needs
    /// it. See [`parse_context_string`].
    transaction_context: String,

    display_hint: String,

    username: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct UserVerificationResponse {
    outcome: UserVerificationOutcome,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum UserVerificationOutcome {
    /// The user completed verification.
    Verified,
    /// The user dismissed the prompt.
    Cancelled,
}

impl From<UserVerificationResponse> for CommandResponse {
    fn from(response: UserVerificationResponse) -> Self {
        Self::UserVerification(response)
    }
}

#[cfg(test)]
mod tests {
    use super::parse_window_handle;

    #[test]
    fn parses_a_pointer_sized_window_handle() {
        let bytes = 0x1234usize.to_le_bytes();

        let handle = parse_window_handle(&bytes).unwrap();

        assert_eq!(handle.0 as usize, 0x1234);
    }

    #[test]
    fn rejects_a_window_handle_of_the_wrong_length() {
        assert!(parse_window_handle(&[0u8; 4]).is_err());
        assert!(parse_window_handle(&[]).is_err());
    }
}
