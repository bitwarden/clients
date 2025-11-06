use serde_json;
use std::alloc::{alloc, Layout};
use std::ptr;
use windows_core::{s, HRESULT};

use crate::com_provider::{
    parse_credential_list, WebAuthnPluginOperationRequest, WebAuthnPluginOperationResponse,
};
use crate::types::*;
use crate::util::{debug_log, delay_load, wstr_to_string};
use crate::webauthn::WEBAUTHN_CREDENTIAL_LIST;

/// Windows WebAuthn registration request context  
#[derive(Debug, Clone)]
pub struct WindowsRegistrationRequest {
    pub rpid: String,
    pub user_id: Vec<u8>,
    pub user_name: String,
    pub user_display_name: Option<String>,
    pub client_data_hash: Vec<u8>,
    pub excluded_credentials: Vec<Vec<u8>>,
    pub user_verification: UserVerificationRequirement,
    pub supported_algorithms: Vec<i32>,
}

// Windows API types for WebAuthn (from webauthn.h.sample)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_RP_ENTITY_INFORMATION {
    pub dwVersion: u32,
    pub pwszId: *const u16,   // PCWSTR
    pub pwszName: *const u16, // PCWSTR
    pub pwszIcon: *const u16, // PCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_USER_ENTITY_INFORMATION {
    pub dwVersion: u32,
    pub cbId: u32,                   // DWORD
    pub pbId: *const u8,             // PBYTE
    pub pwszName: *const u16,        // PCWSTR
    pub pwszIcon: *const u16,        // PCWSTR
    pub pwszDisplayName: *const u16, // PCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    pub dwVersion: u32,
    pub pwszCredentialType: *const u16, // LPCWSTR
    pub lAlg: i32,                      // LONG - COSE algorithm identifier
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    pub cCredentialParameters: u32,
    pub pCredentialParameters: *const WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
}

// Make Credential Request structure (from sample header)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST {
    pub dwVersion: u32,
    pub cbRpId: u32,
    pub pbRpId: *const u8,
    pub cbClientDataHash: u32,
    pub pbClientDataHash: *const u8,
    pub pRpInformation: *const WEBAUTHN_RP_ENTITY_INFORMATION,
    pub pUserInformation: *const WEBAUTHN_USER_ENTITY_INFORMATION,
    pub WebAuthNCredentialParameters: WEBAUTHN_COSE_CREDENTIAL_PARAMETERS, // Matches C++ sample
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    pub cbCborExtensionsMap: u32,
    pub pbCborExtensionsMap: *const u8,
    pub pAuthenticatorOptions:
        *const crate::webauthn::ExperimentalWebAuthnCtapCborAuthenticatorOptions,
    // Add other fields as needed...
}

pub type PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST =
    *mut EXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST;

// Windows API function signatures
type EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequestFn = unsafe extern "stdcall" fn(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppMakeCredentialRequest: *mut PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
) -> HRESULT;

type EXPERIMENTAL_WebAuthNFreeDecodedMakeCredentialRequestFn = unsafe extern "stdcall" fn(
    pMakeCredentialRequest: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
);

// RAII wrapper for decoded make credential request
pub struct DecodedMakeCredentialRequest {
    ptr: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
    free_fn: Option<EXPERIMENTAL_WebAuthNFreeDecodedMakeCredentialRequestFn>,
}

impl DecodedMakeCredentialRequest {
    fn new(
        ptr: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
        free_fn: Option<EXPERIMENTAL_WebAuthNFreeDecodedMakeCredentialRequestFn>,
    ) -> Self {
        Self { ptr, free_fn }
    }

    pub fn as_ref(&self) -> &EXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST {
        unsafe { &*self.ptr }
    }
}

impl Drop for DecodedMakeCredentialRequest {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            if let Some(free_fn) = self.free_fn {
                debug_log("Freeing decoded make credential request");
                unsafe {
                    free_fn(self.ptr);
                }
            }
        }
    }
}

// Function to decode make credential request using Windows API
unsafe fn decode_make_credential_request(
    encoded_request: &[u8],
) -> Result<DecodedMakeCredentialRequest, String> {
    debug_log("Attempting to decode make credential request using Windows API");

    // Try to load the Windows API decode function
    let decode_fn = match delay_load::<EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequestFn>(
        s!("webauthn.dll"),
        s!("EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequest"),
    ) {
        Some(func) => func,
        None => {
            return Err(
                "Failed to load EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequest from webauthn.dll"
                    .to_string(),
            );
        }
    };

    // Try to load the free function (optional, might not be available in all versions)
    let free_fn = delay_load::<EXPERIMENTAL_WebAuthNFreeDecodedMakeCredentialRequestFn>(
        s!("webauthn.dll"),
        s!("EXPERIMENTAL_WebAuthNFreeDecodedMakeCredentialRequest"),
    );

    // Prepare parameters for the API call
    let cb_encoded = encoded_request.len() as u32;
    let pb_encoded = encoded_request.as_ptr();
    let mut pp_make_credential_request: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST =
        std::ptr::null_mut();

    // Call the Windows API function
    let result = decode_fn(cb_encoded, pb_encoded, &mut pp_make_credential_request);

    // Check if the call succeeded (following C++ THROW_IF_FAILED pattern)
    if result.is_err() {
        debug_log(&format!(
            "ERROR: EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequest failed with HRESULT: 0x{:08x}",
            result.0
        ));
        return Err(format!(
            "Windows API call failed with HRESULT: 0x{:08x}",
            result.0
        ));
    }

    if pp_make_credential_request.is_null() {
        debug_log("ERROR: Windows API succeeded but returned null pointer");
        return Err("Windows API returned null pointer".to_string());
    }

    Ok(DecodedMakeCredentialRequest::new(
        pp_make_credential_request,
        free_fn,
    ))
}

/// Helper for registration requests  
fn send_registration_request(
    transaction_id: &str,
    request: &WindowsRegistrationRequest,
) -> Option<PasskeyResponse> {
    debug_log(&format!("Registration request data - RP ID: {}, User ID: {} bytes, User name: {}, Client data hash: {} bytes, Algorithms: {:?}, Excluded credentials: {}", 
        request.rpid, request.user_id.len(), request.user_name, request.client_data_hash.len(), request.supported_algorithms, request.excluded_credentials.len()));

    let passkey_request = PasskeyRegistrationRequest {
        rp_id: request.rpid.clone(),
        transaction_id: transaction_id.to_string(),
        user_handle: request.user_id.clone(),
        user_name: request.user_name.clone(),
        client_data_hash: request.client_data_hash.clone(),
        user_verification: request.user_verification.clone(),
        window_xy: Position { x: 400, y: 400 }, // TODO: Get actual window position
        supported_algorithms: request.supported_algorithms.clone(),
        excluded_credentials: request.excluded_credentials.clone(),
    };

    match serde_json::to_string(&passkey_request) {
        Ok(request_json) => {
            debug_log(&format!("Sending registration request: {}", request_json));
            crate::ipc::send_passkey_request(RequestType::Registration, request_json, &request.rpid)
        }
        Err(e) => {
            debug_log(&format!(
                "ERROR: Failed to serialize registration request: {}",
                e
            ));
            None
        }
    }
}

/// Creates a WebAuthn make credential response from Bitwarden's registration response
unsafe fn create_make_credential_response(
    attestation_object: Vec<u8>,
) -> std::result::Result<*mut WebAuthnPluginOperationResponse, HRESULT> {
    // Use the attestation object directly as the encoded response
    let response_data = attestation_object;
    let response_len = response_data.len();

    // Allocate memory for the response data
    let layout = Layout::from_size_align(response_len, 1).map_err(|_| HRESULT(-1))?;
    let response_ptr = alloc(layout);
    if response_ptr.is_null() {
        return Err(HRESULT(-1));
    }

    // Copy response data
    ptr::copy_nonoverlapping(response_data.as_ptr(), response_ptr, response_len);

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

/// Implementation of PluginMakeCredential moved from com_provider.rs
pub unsafe fn plugin_make_credential(
    request: *const WebAuthnPluginOperationRequest,
    response: *mut WebAuthnPluginOperationResponse,
) -> HRESULT {
    debug_log("=== EXPERIMENTAL_PluginMakeCredential() called ===");

    if request.is_null() {
        debug_log("ERROR: NULL request pointer");
        return HRESULT(-1);
    }

    if response.is_null() {
        debug_log("ERROR: NULL response pointer");
        return HRESULT(-1);
    }

    let req = &*request;
    let transaction_id = format!("{:?}", req.transaction_id);

    if req.encoded_request_byte_count == 0 || req.encoded_request_pointer.is_null() {
        debug_log("ERROR: No encoded request data provided");
        return HRESULT(-1);
    }

    let encoded_request_slice = std::slice::from_raw_parts(
        req.encoded_request_pointer,
        req.encoded_request_byte_count as usize,
    );

    debug_log(&format!(
        "Encoded request: {} bytes",
        encoded_request_slice.len()
    ));

    // Try to decode the request using Windows API
    match decode_make_credential_request(encoded_request_slice) {
        Ok(decoded_wrapper) => {
            let decoded_request = decoded_wrapper.as_ref();
            debug_log("Successfully decoded make credential request using Windows API");

            // Extract RP information
            if decoded_request.pRpInformation.is_null() {
                debug_log("ERROR: RP information is null");
                return HRESULT(-1);
            }

            let rp_info = &*decoded_request.pRpInformation;

            let rpid = if rp_info.pwszId.is_null() {
                debug_log("ERROR: RP ID is null");
                return HRESULT(-1);
            } else {
                match wstr_to_string(rp_info.pwszId) {
                    Ok(id) => id,
                    Err(e) => {
                        debug_log(&format!("ERROR: Failed to decode RP ID: {}", e));
                        return HRESULT(-1);
                    }
                }
            };

            // let rp_name = if rp_info.pwszName.is_null() {
            //     String::new()
            // } else {
            //     wstr_to_string(rp_info.pwszName).unwrap_or_default()
            // };

            // Extract user information
            if decoded_request.pUserInformation.is_null() {
                debug_log("ERROR: User information is null");
                return HRESULT(-1);
            }

            let user = &*decoded_request.pUserInformation;

            let user_id = if user.pbId.is_null() || user.cbId == 0 {
                debug_log("ERROR: User ID is required for registration");
                return HRESULT(-1);
            } else {
                let id_slice = std::slice::from_raw_parts(user.pbId, user.cbId as usize);
                id_slice.to_vec()
            };

            let user_name = if user.pwszName.is_null() {
                debug_log("ERROR: User name is required for registration");
                return HRESULT(-1);
            } else {
                match wstr_to_string(user.pwszName) {
                    Ok(name) => name,
                    Err(_) => {
                        debug_log("ERROR: Failed to decode user name");
                        return HRESULT(-1);
                    }
                }
            };

            let user_display_name = if user.pwszDisplayName.is_null() {
                None
            } else {
                wstr_to_string(user.pwszDisplayName).ok()
            };

            let user_info = (user_id, user_name, user_display_name);

            // Extract client data hash
            let client_data_hash = if decoded_request.cbClientDataHash == 0
                || decoded_request.pbClientDataHash.is_null()
            {
                debug_log("ERROR: Client data hash is required for registration");
                return HRESULT(-1);
            } else {
                let hash_slice = std::slice::from_raw_parts(
                    decoded_request.pbClientDataHash,
                    decoded_request.cbClientDataHash as usize,
                );
                hash_slice.to_vec()
            };

            // Extract supported algorithms
            let supported_algorithms = if decoded_request
                .WebAuthNCredentialParameters
                .cCredentialParameters
                > 0
                && !decoded_request
                    .WebAuthNCredentialParameters
                    .pCredentialParameters
                    .is_null()
            {
                let params_count = decoded_request
                    .WebAuthNCredentialParameters
                    .cCredentialParameters as usize;
                let params_ptr = decoded_request
                    .WebAuthNCredentialParameters
                    .pCredentialParameters;

                (0..params_count)
                    .map(|i| unsafe { &*params_ptr.add(i) }.lAlg)
                    .collect()
            } else {
                Vec::new()
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

            // Extract excluded credentials from credential list
            let excluded_credentials = parse_credential_list(&decoded_request.CredentialList);
            if !excluded_credentials.is_empty() {
                debug_log(&format!(
                    "Found {} excluded credentials for make credential",
                    excluded_credentials.len()
                ));
            }

            // Create Windows registration request
            let registration_request = WindowsRegistrationRequest {
                rpid: rpid.clone(),
                user_id: user_info.0,
                user_name: user_info.1,
                user_display_name: user_info.2,
                client_data_hash,
                excluded_credentials,
                user_verification: user_verification.unwrap_or_default(),
                supported_algorithms,
            };

            debug_log(&format!(
                "Make credential request - RP: {}, User: {}",
                rpid, registration_request.user_name
            ));

            // Send registration request
            if let Some(passkey_response) =
                send_registration_request(&transaction_id, &registration_request)
            {
                debug_log(&format!(
                    "Registration response received: {:?}",
                    passkey_response
                ));

                // Create proper WebAuthn response from passkey_response
                match passkey_response {
                    PasskeyResponse::RegistrationResponse {
                        credential_id: _,
                        attestation_object,
                        rp_id: _,
                        client_data_hash: _,
                    } => {
                        debug_log("Creating WebAuthn make credential response");

                        match create_make_credential_response(attestation_object) {
                            Ok(webauthn_response) => {
                                debug_log("Successfully created WebAuthn response");
                                (*response).encoded_response_byte_count =
                                    (*webauthn_response).encoded_response_byte_count;
                                (*response).encoded_response_pointer =
                                    (*webauthn_response).encoded_response_pointer;
                                HRESULT(0)
                            }
                            Err(e) => {
                                debug_log(&format!(
                                    "ERROR: Failed to create WebAuthn response: {}",
                                    e
                                ));
                                HRESULT(-1)
                            }
                        }
                    }
                    PasskeyResponse::Error { message } => {
                        debug_log(&format!("Registration request failed: {}", message));
                        HRESULT(-1)
                    }
                    _ => {
                        debug_log("ERROR: Unexpected response type for registration request");
                        HRESULT(-1)
                    }
                }
            } else {
                debug_log("ERROR: No response from registration request");
                HRESULT(-1)
            }
        }
        Err(e) => {
            debug_log(&format!(
                "ERROR: Failed to decode make credential request: {}",
                e
            ));
            HRESULT(-1)
        }
    }
}
