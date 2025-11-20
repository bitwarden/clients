use windows::Win32::Foundation::RECT;
use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

use crate::webauthn::WEBAUTHN_CREDENTIAL_LIST;

/// Plugin request type enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum WebAuthnPluginRequestType {
    CTAP2_CBOR = 0x01,
}

/*
/// Plugin lock status enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum PluginLockStatus {
    PluginLocked = 0,
    PluginUnlocked = 1,
}
*/

/// Used when creating and asserting credentials.
/// Header File Name: _WEBAUTHN_PLUGIN_OPERATION_REQUEST
/// Header File Usage: MakeCredential()
///                    GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnPluginOperationRequest {
    pub window_handle: windows::Win32::Foundation::HWND,
    pub transaction_id: windows::core::GUID,
    pub request_signature_byte_count: u32,
    pub request_signature_pointer: *mut u8,
    pub request_type: WebAuthnPluginRequestType,
    pub encoded_request_byte_count: u32,
    pub encoded_request_pointer: *mut u8,
}

impl WebAuthnPluginOperationRequest {
    pub fn window_coordinates(&self) -> Result<(i32, i32), windows::core::Error> {
        let mut window: RECT = RECT::default();
        unsafe {
            GetWindowRect(self.window_handle, &mut window)?;
        }
        // TODO: This isn't quite right, but it's closer than what we had
        let center_x = (window.right + window.left) / 2;
        let center_y = (window.bottom + window.top) / 2;
        Ok((center_x, center_y))
    }
}
/// Used as a response when creating and asserting credentials.
/// Header File Name: _WEBAUTHN_PLUGIN_OPERATION_RESPONSE
/// Header File Usage: MakeCredential()
///                    GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnPluginOperationResponse {
    pub encoded_response_byte_count: u32,
    pub encoded_response_pointer: *mut u8,
}

pub unsafe fn parse_credential_list(credential_list: &WEBAUTHN_CREDENTIAL_LIST) -> Vec<Vec<u8>> {
    let mut allowed_credentials = Vec::new();

    if credential_list.cCredentials == 0 || credential_list.ppCredentials.is_null() {
        tracing::debug!("No credentials in credential list");
        return allowed_credentials;
    }

    tracing::debug!(
        "Parsing {} credentials from credential list",
        credential_list.cCredentials
    );

    // ppCredentials is an array of pointers to WEBAUTHN_CREDENTIAL_EX
    let credentials_array = std::slice::from_raw_parts(
        credential_list.ppCredentials,
        credential_list.cCredentials as usize,
    );

    for (i, &credential_ptr) in credentials_array.iter().enumerate() {
        if credential_ptr.is_null() {
            tracing::debug!("WARNING: Credential {} is null, skipping", i);
            continue;
        }

        let credential = &*credential_ptr;

        if credential.cbId == 0 || credential.pbId.is_null() {
            tracing::debug!("WARNING: Credential {} has invalid ID, skipping", i);
            continue;
        }
        // Extract credential ID bytes
        // For some reason, we're getting hex strings from Windows instead of bytes.
        let credential_id_slice =
            std::slice::from_raw_parts(credential.pbId, credential.cbId as usize);

        tracing::debug!(
            "Parsed credential {}: {} bytes, {:?}",
            i,
            credential.cbId,
            &credential_id_slice,
        );
        allowed_credentials.push(credential_id_slice.to_vec());
    }

    tracing::debug!(
        "Successfully parsed {} allowed credentials",
        allowed_credentials.len()
    );
    allowed_credentials
}
