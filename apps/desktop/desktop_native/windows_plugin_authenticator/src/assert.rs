use serde_json;
use std::alloc::{alloc, Layout};
use std::ptr;
use windows_core::{s, HRESULT};

use crate::com_provider::{
    parse_credential_list, ExperimentalWebAuthnPluginOperationRequest,
    ExperimentalWebAuthnPluginOperationResponse,
};
use crate::types::*;
use crate::util::{debug_log, delay_load, wstr_to_string};
use crate::webauthn::WEBAUTHN_CREDENTIAL_LIST;

// Windows API types for WebAuthn (from webauthn.h.sample)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
    pub dwVersion: u32,
    pub pwszRpId: *const u16, // PCWSTR
    pub cbRpId: u32,
    pub pbRpId: *const u8,
    pub cbClientDataHash: u32,
    pub pbClientDataHash: *const u8,
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    pub cbCborExtensionsMap: u32,
    pub pbCborExtensionsMap: *const u8,
    pub pAuthenticatorOptions:
        *const crate::webauthn::ExperimentalWebAuthnCtapCborAuthenticatorOptions,
    // Add other fields as needed...
}

pub type PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST =
    *mut EXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST;

// Windows API function signatures for decoding get assertion requests
type EXPERIMENTAL_WebAuthNDecodeGetAssertionRequestFn = unsafe extern "stdcall" fn(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppGetAssertionRequest: *mut PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
) -> HRESULT;

type EXPERIMENTAL_WebAuthNFreeDecodedGetAssertionRequestFn = unsafe extern "stdcall" fn(
    pGetAssertionRequest: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
);

// RAII wrapper for decoded get assertion request
pub struct DecodedGetAssertionRequest {
    ptr: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
    free_fn: Option<EXPERIMENTAL_WebAuthNFreeDecodedGetAssertionRequestFn>,
}

impl DecodedGetAssertionRequest {
    fn new(
        ptr: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
        free_fn: Option<EXPERIMENTAL_WebAuthNFreeDecodedGetAssertionRequestFn>,
    ) -> Self {
        Self { ptr, free_fn }
    }

    pub fn as_ref(&self) -> &EXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
        unsafe { &*self.ptr }
    }
}

impl Drop for DecodedGetAssertionRequest {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            if let Some(free_fn) = self.free_fn {
                debug_log("Freeing decoded get assertion request");
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
    debug_log("Attempting to decode get assertion request using Windows API");

    // Load the Windows WebAuthn API function
    let decode_fn: Option<EXPERIMENTAL_WebAuthNDecodeGetAssertionRequestFn> = delay_load(
        s!("webauthn.dll"),
        s!("EXPERIMENTAL_WebAuthNDecodeGetAssertionRequest"),
    );

    let decode_fn = decode_fn
        .ok_or("Failed to load EXPERIMENTAL_WebAuthNDecodeGetAssertionRequest from webauthn.dll")?;

    // Load the free function
    let free_fn: Option<EXPERIMENTAL_WebAuthNFreeDecodedGetAssertionRequestFn> = delay_load(
        s!("webauthn.dll"),
        s!("EXPERIMENTAL_WebAuthNFreeDecodedGetAssertionRequest"),
    );

    let mut pp_get_assertion_request: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST =
        ptr::null_mut();

    let result = decode_fn(
        encoded_request.len() as u32,
        encoded_request.as_ptr(),
        &mut pp_get_assertion_request,
    );

    if result.is_err() || pp_get_assertion_request.is_null() {
        return Err(format!(
            "EXPERIMENTAL_WebAuthNDecodeGetAssertionRequest failed with HRESULT: {}",
            result.0
        ));
    }

    Ok(DecodedGetAssertionRequest::new(
        pp_get_assertion_request,
        free_fn,
    ))
}

/// Windows WebAuthn assertion request context
#[derive(Debug, Clone)]
pub struct WindowsAssertionRequest {
    pub rpid: String,
    pub client_data_hash: Vec<u8>,
    pub allowed_credentials: Vec<Vec<u8>>,
    pub user_verification: UserVerificationRequirement,
}

/// Helper for assertion requests
fn send_assertion_request(
    transaction_id: &str,
    request: &WindowsAssertionRequest,
) -> Option<PasskeyResponse> {
    let passkey_request = PasskeyAssertionRequest {
        rp_id: request.rpid.clone(),
        transaction_id: transaction_id.to_string(),
        client_data_hash: request.client_data_hash.clone(),
        allowed_credentials: request.allowed_credentials.clone(),
        user_verification: request.user_verification.clone(),
        window_xy: Position { x: 400, y: 400 },
    };

    debug_log(&format!(
        "Assertion request data - RP ID: {}, Client data hash: {} bytes, Allowed credentials: {}",
        request.rpid,
        request.client_data_hash.len(),
        request.allowed_credentials.len()
    ));

    match serde_json::to_string(&passkey_request) {
        Ok(request_json) => {
            debug_log(&format!("Sending assertion request: {}", request_json));
            crate::ipc::send_passkey_request(RequestType::Assertion, request_json, &request.rpid)
        }
        Err(e) => {
            debug_log(&format!(
                "ERROR: Failed to serialize assertion request: {}",
                e
            ));
            None
        }
    }
}

/// Creates a WebAuthn get assertion response from Bitwarden's assertion response
unsafe fn create_get_assertion_response(
    credential_id: Vec<u8>,
    authenticator_data: Vec<u8>,
    signature: Vec<u8>,
    user_handle: Vec<u8>,
) -> std::result::Result<*mut ExperimentalWebAuthnPluginOperationResponse, HRESULT> {
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

    let cbor_value = ciborium::Value::Map(cbor_response);

    // Encode to CBOR with error handling
    let mut cbor_data = Vec::new();
    if let Err(e) = ciborium::ser::into_writer(&cbor_value, &mut cbor_data) {
        debug_log(&format!(
            "ERROR: Failed to encode CBOR assertion response: {:?}",
            e
        ));
        return Err(HRESULT(-1));
    }

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
    let response_layout = Layout::new::<ExperimentalWebAuthnPluginOperationResponse>();
    let operation_response_ptr =
        alloc(response_layout) as *mut ExperimentalWebAuthnPluginOperationResponse;
    if operation_response_ptr.is_null() {
        return Err(HRESULT(-1));
    }

    // Initialize the response
    ptr::write(
        operation_response_ptr,
        ExperimentalWebAuthnPluginOperationResponse {
            encoded_response_byte_count: response_len as u32,
            encoded_response_pointer: response_ptr,
        },
    );

    Ok(operation_response_ptr)
}

/// Implementation of EXPERIMENTAL_PluginGetAssertion moved from com_provider.rs
pub unsafe fn experimental_plugin_get_assertion(
    request: *const ExperimentalWebAuthnPluginOperationRequest,
    response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
) -> HRESULT {
    debug_log("EXPERIMENTAL_PluginGetAssertion() called");

    // Validate input parameters
    if request.is_null() || response.is_null() {
        debug_log("Invalid parameters passed to EXPERIMENTAL_PluginGetAssertion");
        return HRESULT(-1);
    }

    let req = &*request;
    let transaction_id = format!("{:?}", req.transaction_id);

    debug_log(&format!(
        "Get assertion request - Transaction: {}",
        transaction_id
    ));

    if req.encoded_request_byte_count == 0 || req.encoded_request_pointer.is_null() {
        debug_log("ERROR: No encoded request data provided");
        *response = ptr::null_mut();
        return HRESULT(-1);
    }

    let encoded_request_slice = std::slice::from_raw_parts(
        req.encoded_request_pointer,
        req.encoded_request_byte_count as usize,
    );

    // Try to decode the request using Windows API
    match decode_get_assertion_request(encoded_request_slice) {
        Ok(decoded_wrapper) => {
            let decoded_request = decoded_wrapper.as_ref();
            debug_log("Successfully decoded get assertion request using Windows API");

            // Extract RP information
            let rpid = if decoded_request.pwszRpId.is_null() {
                debug_log("ERROR: RP ID is null");
                *response = ptr::null_mut();
                return HRESULT(-1);
            } else {
                match wstr_to_string(decoded_request.pwszRpId) {
                    Ok(id) => id,
                    Err(e) => {
                        debug_log(&format!("ERROR: Failed to decode RP ID: {}", e));
                        *response = ptr::null_mut();
                        return HRESULT(-1);
                    }
                }
            };

            // Extract client data hash
            let client_data_hash = if decoded_request.cbClientDataHash == 0
                || decoded_request.pbClientDataHash.is_null()
            {
                debug_log("ERROR: Client data hash is required for assertion");
                *response = ptr::null_mut();
                return HRESULT(-1);
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
                    1 => Some(UserVerificationRequirement::Required),
                    -1 => Some(UserVerificationRequirement::Discouraged),
                    0 | _ => Some(UserVerificationRequirement::Preferred), // Default or undefined
                }
            } else {
                None
            };

            // Extract allowed credentials from credential list
            let allowed_credentials = parse_credential_list(&decoded_request.CredentialList);

            // Create Windows assertion request
            let assertion_request = WindowsAssertionRequest {
                rpid: rpid.clone(),
                client_data_hash,
                allowed_credentials: allowed_credentials.clone(),
                user_verification: user_verification.unwrap_or_default(),
            };

            debug_log(&format!(
                "Get assertion request - RP: {}, Allowed credentials: {}",
                rpid,
                allowed_credentials.len()
            ));

            // Send assertion request
            if let Some(passkey_response) =
                send_assertion_request(&transaction_id, &assertion_request)
            {
                debug_log(&format!(
                    "Assertion response received: {:?}",
                    passkey_response
                ));

                // Create proper WebAuthn response from passkey_response
                match passkey_response {
                    PasskeyResponse::AssertionResponse {
                        credential_id,
                        authenticator_data,
                        signature,
                        user_handle,
                        rp_id: _,
                        client_data_hash: _,
                    } => {
                        debug_log("Creating WebAuthn get assertion response");

                        match create_get_assertion_response(
                            credential_id,
                            authenticator_data,
                            signature,
                            user_handle,
                        ) {
                            Ok(webauthn_response) => {
                                debug_log("Successfully created WebAuthn assertion response");
                                *response = webauthn_response;
                                HRESULT(0)
                            }
                            Err(e) => {
                                debug_log(&format!(
                                    "ERROR: Failed to create WebAuthn assertion response: {}",
                                    e
                                ));
                                *response = ptr::null_mut();
                                HRESULT(-1)
                            }
                        }
                    }
                    PasskeyResponse::Error { message } => {
                        debug_log(&format!("Assertion request failed: {}", message));
                        *response = ptr::null_mut();
                        HRESULT(-1)
                    }
                    _ => {
                        debug_log("ERROR: Unexpected response type for assertion request");
                        *response = ptr::null_mut();
                        HRESULT(-1)
                    }
                }
            } else {
                debug_log("ERROR: No response from assertion request");
                *response = ptr::null_mut();
                HRESULT(-1)
            }
        }
        Err(e) => {
            debug_log(&format!(
                "ERROR: Failed to decode get assertion request: {}",
                e
            ));
            *response = ptr::null_mut();
            HRESULT(-1)
        }
    }
}
