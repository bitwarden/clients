use serde_json;
use std::{
    alloc::{alloc, Layout},
    ptr,
    sync::Arc,
    time::Duration,
};
use windows::core::{s, HRESULT};

use crate::ipc2::{
    PasskeyAssertionRequest, PasskeyAssertionResponse, Position, TimedCallback, UserVerification,
    WindowsProviderClient,
};
use crate::util::{delay_load, wstr_to_string};
use crate::webauthn::WEBAUTHN_CREDENTIAL_LIST;
use crate::{
    com_provider::{
        parse_credential_list, WebAuthnPluginOperationRequest, WebAuthnPluginOperationResponse,
    },
    ipc2::PasskeyAssertionWithoutUserInterfaceRequest,
};

// Windows API types for WebAuthn (from webauthn.h.sample)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
    pub dwVersion: u32,
    pub pwszRpId: *const u16, // PCWSTR
    pub cbRpId: u32,
    pub pbRpId: *const u8,
    pub cbClientDataHash: u32,
    pub pbClientDataHash: *const u8,
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    pub cbCborExtensionsMap: u32,
    pub pbCborExtensionsMap: *const u8,
    pub pAuthenticatorOptions: *const crate::webauthn::WebAuthnCtapCborAuthenticatorOptions,
    // Add other fields as needed...
}

pub type PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST = *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST;

// Windows API function signatures for decoding get assertion requests
type WebAuthNDecodeGetAssertionRequestFn = unsafe extern "stdcall" fn(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppGetAssertionRequest: *mut PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
) -> HRESULT;

type WebAuthNFreeDecodedGetAssertionRequestFn =
    unsafe extern "stdcall" fn(pGetAssertionRequest: PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST);

// RAII wrapper for decoded get assertion request
pub struct DecodedGetAssertionRequest {
    ptr: PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
    free_fn: Option<WebAuthNFreeDecodedGetAssertionRequestFn>,
}

impl DecodedGetAssertionRequest {
    fn new(
        ptr: PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
        free_fn: Option<WebAuthNFreeDecodedGetAssertionRequestFn>,
    ) -> Self {
        Self { ptr, free_fn }
    }

    pub fn as_ref(&self) -> &WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
        unsafe { &*self.ptr }
    }
}

impl Drop for DecodedGetAssertionRequest {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            if let Some(free_fn) = self.free_fn {
                tracing::debug!("Freeing decoded get assertion request");
                unsafe {
                    free_fn(self.ptr);
                }
            }
        }
    }
}

// Function to decode get assertion request using Windows API
unsafe fn decode_get_assertion_request(
    encoded_request: &[u8],
) -> Result<DecodedGetAssertionRequest, String> {
    tracing::debug!("Attempting to decode get assertion request using Windows API");

    // Load the Windows WebAuthn API function
    let decode_fn: Option<WebAuthNDecodeGetAssertionRequestFn> =
        delay_load(s!("webauthn.dll"), s!("WebAuthNDecodeGetAssertionRequest"));

    let decode_fn =
        decode_fn.ok_or("Failed to load WebAuthNDecodeGetAssertionRequest from webauthn.dll")?;

    // Load the free function
    let free_fn: Option<WebAuthNFreeDecodedGetAssertionRequestFn> = delay_load(
        s!("webauthn.dll"),
        s!("WebAuthNFreeDecodedGetAssertionRequest"),
    );

    let mut pp_get_assertion_request: PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST = ptr::null_mut();

    let result = decode_fn(
        encoded_request.len() as u32,
        encoded_request.as_ptr(),
        &mut pp_get_assertion_request,
    );

    if result.is_err() || pp_get_assertion_request.is_null() {
        return Err(format!(
            "WebAuthNDecodeGetAssertionRequest failed with HRESULT: {}",
            result.0
        ));
    }

    Ok(DecodedGetAssertionRequest::new(
        pp_get_assertion_request,
        free_fn,
    ))
}

/// Helper for assertion requests
fn send_assertion_request(
    ipc_client: &WindowsProviderClient,
    request: PasskeyAssertionRequest,
) -> Result<PasskeyAssertionResponse, String> {
    tracing::debug!(
        "Assertion request data - RP ID: {}, Client data hash: {} bytes, Allowed credentials: {:?}",
        request.rp_id,
        request.client_data_hash.len(),
        request.allowed_credentials,
    );

    let request_json = serde_json::to_string(&request)
        .map_err(|err| format!("Failed to serialize assertion request: {err}"))?;
    tracing::debug!(?request_json, "Sending assertion request");
    let callback = Arc::new(TimedCallback::new());
    if request.allowed_credentials.len() == 1 {
        // copying this into another struct because I'm too lazy to make an enum right now.
        let request = PasskeyAssertionWithoutUserInterfaceRequest {
            rp_id: request.rp_id,
            credential_id: request.allowed_credentials[0].clone(),
            // user_name: request.user_name,
            // user_handle: request.,
            // record_identifier: todo!(),
            client_data_hash: request.client_data_hash,
            user_verification: request.user_verification,
            window_xy: request.window_xy,
            context: request.context,
        };
        ipc_client.prepare_passkey_assertion_without_user_interface(request, callback.clone());
    } else {
        ipc_client.prepare_passkey_assertion(request, callback.clone());
    }
    callback
        .wait_for_response(Duration::from_secs(30))
        .map_err(|_| "Registration request timed out".to_string())?
        .map_err(|err| err.to_string())
}

/// Creates a WebAuthn get assertion response from Bitwarden's assertion response
unsafe fn create_get_assertion_response(
    credential_id: Vec<u8>,
    authenticator_data: Vec<u8>,
    signature: Vec<u8>,
    user_handle: Vec<u8>,
) -> std::result::Result<*mut WebAuthnPluginOperationResponse, HRESULT> {
    // Construct a CTAP2 response with the proper structure

    // Create CTAP2 GetAssertion response map according to CTAP2 specification
    let mut cbor_response: Vec<(ciborium::Value, ciborium::Value)> = Vec::new();

    // [1] credential (optional) - Always include credential descriptor
    let credential_map = vec![
        (
            ciborium::Value::Text("id".to_string()),
            ciborium::Value::Bytes(credential_id.clone()),
        ),
        (
            ciborium::Value::Text("type".to_string()),
            ciborium::Value::Text("public-key".to_string()),
        ),
    ];
    cbor_response.push((
        ciborium::Value::Integer(1.into()),
        ciborium::Value::Map(credential_map),
    ));

    // [2] authenticatorData (required)
    cbor_response.push((
        ciborium::Value::Integer(2.into()),
        ciborium::Value::Bytes(authenticator_data),
    ));

    // [3] signature (required)
    cbor_response.push((
        ciborium::Value::Integer(3.into()),
        ciborium::Value::Bytes(signature),
    ));

    // [4] user (optional) - include if user handle is provided
    if !user_handle.is_empty() {
        let user_map = vec![(
            ciborium::Value::Text("id".to_string()),
            ciborium::Value::Bytes(user_handle),
        )];
        cbor_response.push((
            ciborium::Value::Integer(4.into()),
            ciborium::Value::Map(user_map),
        ));
    }

    // [5] numberOfCredentials (optional)
    cbor_response.push((
        ciborium::Value::Integer(5.into()),
        ciborium::Value::Integer(1.into()),
    ));

    let cbor_value = ciborium::Value::Map(cbor_response);

    // Encode to CBOR with error handling
    let mut cbor_data = Vec::new();
    if let Err(e) = ciborium::ser::into_writer(&cbor_value, &mut cbor_data) {
        tracing::debug!("ERROR: Failed to encode CBOR assertion response: {:?}", e);
        return Err(HRESULT(-1));
    }

    tracing::debug!("Formatted CBOR assertion response: {:?}", cbor_data);

    let response_len = cbor_data.len();

    // Allocate memory for the response data
    let layout = Layout::from_size_align(response_len, 1).map_err(|_| HRESULT(-1))?;
    let response_ptr = alloc(layout);
    if response_ptr.is_null() {
        return Err(HRESULT(-1));
    }

    // Copy response data
    ptr::copy_nonoverlapping(cbor_data.as_ptr(), response_ptr, response_len);

    // Allocate memory for the response structure
    let response_layout = Layout::new::<WebAuthnPluginOperationResponse>();
    let operation_response_ptr = alloc(response_layout) as *mut WebAuthnPluginOperationResponse;
    if operation_response_ptr.is_null() {
        return Err(HRESULT(-1));
    }

    // Initialize the response
    ptr::write(
        operation_response_ptr,
        WebAuthnPluginOperationResponse {
            encoded_response_byte_count: response_len as u32,
            encoded_response_pointer: response_ptr,
        },
    );

    Ok(operation_response_ptr)
}

/// Implementation of PluginGetAssertion moved from com_provider.rs
pub unsafe fn plugin_get_assertion(
    ipc_client: &WindowsProviderClient,
    request: *const WebAuthnPluginOperationRequest,
    response: *mut WebAuthnPluginOperationResponse,
) -> Result<(), HRESULT> {
    tracing::debug!("PluginGetAssertion() called");

    // Validate input parameters
    if request.is_null() || response.is_null() {
        tracing::debug!("Invalid parameters passed to PluginGetAssertion");
        return Err(HRESULT(-1));
    }

    let req = &*request;
    let transaction_id = format!("{:?}", req.transaction_id);
    let coords = req.window_coordinates().unwrap_or((400, 400));

    tracing::debug!("Get assertion request - Transaction: {}", transaction_id);

    if req.encoded_request_byte_count == 0 || req.encoded_request_pointer.is_null() {
        tracing::error!("No encoded request data provided");
        return Err(HRESULT(-1));
    }

    let encoded_request_slice = std::slice::from_raw_parts(
        req.encoded_request_pointer,
        req.encoded_request_byte_count as usize,
    );

    // Try to decode the request using Windows API
    let decoded_wrapper = decode_get_assertion_request(encoded_request_slice).map_err(|err| {
        tracing::debug!("Failed to decode get assertion request: {err}");
        HRESULT(-1)
    })?;
    let decoded_request = decoded_wrapper.as_ref();
    tracing::debug!("Successfully decoded get assertion request using Windows API");

    // Extract RP information
    let rpid = if decoded_request.pwszRpId.is_null() {
        tracing::error!("RP ID is null");
        return Err(HRESULT(-1));
    } else {
        match wstr_to_string(decoded_request.pwszRpId) {
            Ok(id) => id,
            Err(e) => {
                tracing::error!("Failed to decode RP ID: {}", e);
                return Err(HRESULT(-1));
            }
        }
    };

    // Extract client data hash
    let client_data_hash =
        if decoded_request.cbClientDataHash == 0 || decoded_request.pbClientDataHash.is_null() {
            tracing::error!("Client data hash is required for assertion");
            return Err(HRESULT(-1));
        } else {
            let hash_slice = std::slice::from_raw_parts(
                decoded_request.pbClientDataHash,
                decoded_request.cbClientDataHash as usize,
            );
            hash_slice.to_vec()
        };

    // Extract user verification requirement from authenticator options
    let user_verification = if !decoded_request.pAuthenticatorOptions.is_null() {
        let auth_options = &*decoded_request.pAuthenticatorOptions;
        match auth_options.user_verification {
            1 => UserVerification::Required,
            -1 => UserVerification::Discouraged,
            0 | _ => UserVerification::Preferred, // Default or undefined
        }
    } else {
        UserVerification::Preferred // Default or undefined
    };

    // Extract allowed credentials from credential list
    let allowed_credentials = parse_credential_list(&decoded_request.CredentialList);

    // Create Windows assertion request
    let transaction_id = req.transaction_id.to_u128().to_le_bytes().to_vec();
    let assertion_request = PasskeyAssertionRequest {
        rp_id: rpid.clone(),
        client_data_hash,
        allowed_credentials: allowed_credentials.clone(),
        user_verification,
        window_xy: Position {
            x: coords.0,
            y: coords.1,
        },
        context: transaction_id,
    };

    tracing::debug!(
        "Get assertion request - RP: {}, Allowed credentials: {:?}",
        rpid,
        allowed_credentials
    );

    // Send assertion request
    let passkey_response =
        send_assertion_request(ipc_client, assertion_request).map_err(|err| {
            tracing::error!("Assertion request failed: {err}");
            HRESULT(-1)
        })?;
    tracing::debug!("Assertion response received: {:?}", passkey_response);

    // Create proper WebAuthn response from passkey_response
    tracing::debug!("Creating WebAuthn get assertion response");

    let webauthn_response = create_get_assertion_response(
        passkey_response.credential_id,
        passkey_response.authenticator_data,
        passkey_response.signature,
        passkey_response.user_handle,
    )
    .map_err(|err| {
        tracing::error!("Failed to create WebAuthn assertion response: {err}");
        HRESULT(-1)
    })?;
    tracing::debug!("Successfully created WebAuthn assertion response");
    (*response).encoded_response_byte_count = (*webauthn_response).encoded_response_byte_count;
    (*response).encoded_response_pointer = (*webauthn_response).encoded_response_pointer;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::ptr::slice_from_raw_parts;

    use super::create_get_assertion_response;

    #[test]
    fn test_create_native_assertion_response() {
        let credential_id = vec![1, 2, 3, 4];
        let authenticator_data = vec![5, 6, 7, 8];
        let signature = vec![9, 10, 11, 12];
        let user_handle = vec![13, 14, 15, 16];
        let slice = unsafe {
            let response = *create_get_assertion_response(
                credential_id,
                authenticator_data,
                signature,
                user_handle,
            )
            .unwrap();
            &*slice_from_raw_parts(
                response.encoded_response_pointer,
                response.encoded_response_byte_count as usize,
            )
        };
        // CTAP2_OK, Map(5 elements)
        assert_eq!([0x00, 0xa5], slice[..2]);
    }
}
