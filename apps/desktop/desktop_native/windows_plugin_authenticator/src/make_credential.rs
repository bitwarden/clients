use std::alloc::{alloc, Layout};
use std::ptr;
use serde_json;
use windows_core::{HRESULT, s};

use crate::types::*;
use crate::utils::{self as util, delay_load};
use crate::com_provider::ExperimentalWebAuthnPluginOperationResponse;
use crate::assert::RequestContext;

// Windows API types for WebAuthn (from webauthn.h.sample)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_RP_ENTITY_INFORMATION {
    pub dwVersion: u32,
    pub pwszId: *const u16,     // PCWSTR
    pub pwszName: *const u16,   // PCWSTR  
    pub pwszIcon: *const u16,   // PCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_USER_ENTITY_INFORMATION {
    pub dwVersion: u32,
    pub cbId: u32,              // DWORD
    pub pbId: *const u8,        // PBYTE
    pub pwszName: *const u16,   // PCWSTR
    pub pwszIcon: *const u16,   // PCWSTR
    pub pwszDisplayName: *const u16, // PCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    pub dwVersion: u32,
    pub pwszCredentialType: *const u16,  // LPCWSTR
    pub lAlg: i32,                       // LONG - COSE algorithm identifier
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    pub cCredentialParameters: u32,
    pub pCredentialParameters: *const WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CREDENTIAL_LIST {
    pub cCredentials: u32,
    pub pCredentials: *const u8, // Placeholder
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
    pub WebAuthNCredentialParameters: WEBAUTHN_COSE_CREDENTIAL_PARAMETERS,  // Matches C++ sample
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    pub cbCborExtensionsMap: u32,
    pub pbCborExtensionsMap: *const u8,
    // Add other fields as needed...
}

pub type PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST = *mut EXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST;

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
    fn new(ptr: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST, free_fn: Option<EXPERIMENTAL_WebAuthNFreeDecodedMakeCredentialRequestFn>) -> Self {
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
                util::message("Freeing decoded make credential request");
                unsafe { free_fn(self.ptr); }
            }
        }
    }
}

// Function to decode make credential request using Windows API
pub unsafe fn decode_make_credential_request(encoded_request: &[u8]) -> Result<DecodedMakeCredentialRequest, String> {
    util::message("Attempting to decode make credential request using Windows API");
    
    // Try to load the Windows API decode function
    let decode_fn = match delay_load::<EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequestFn>(
        s!("webauthn.dll"),
        s!("EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequest"),
    ) {
        Some(func) => func,
        None => {
            return Err("Failed to load EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequest from webauthn.dll".to_string());
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
    let mut pp_make_credential_request: PEXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST = std::ptr::null_mut();
    
    
    // Call the Windows API function
    let result = decode_fn(
        cb_encoded,
        pb_encoded,
        &mut pp_make_credential_request,
    );
    
    // Check if the call succeeded (following C++ THROW_IF_FAILED pattern)
    if result.is_err() {
        util::message(&format!("ERROR: EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequest failed with HRESULT: 0x{:08x}", result.0));
        return Err(format!("Windows API call failed with HRESULT: 0x{:08x}", result.0));
    }
    
    if pp_make_credential_request.is_null() {
        util::message("ERROR: Windows API succeeded but returned null pointer");
        return Err("Windows API returned null pointer".to_string());
    }
    
    
    Ok(DecodedMakeCredentialRequest::new(pp_make_credential_request, free_fn))
}

/// Helper for registration requests  
pub fn send_registration_request(rpid: &str, transaction_id: &str, context: &RequestContext) -> Option<PasskeyResponse> {
    // Validate required fields
    if rpid.is_empty() {
        util::message("ERROR: RP ID is required but empty");
        return None;
    }
    
    // Extract user ID from context - this is required for registration
    let user_id = match &context.user_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => {
            util::message("ERROR: User ID is required for registration but not provided");
            return None;
        }
    };
    
    // Extract user name from context - this is required for registration
    let user_name = match &context.user_name {
        Some(name) if !name.is_empty() => name.clone(),
        _ => {
            util::message("ERROR: User name is required for registration but not provided");
            return None;
        }
    };
    
    // Extract client data hash from context - this is required for WebAuthn
    let client_data_hash = match &context.client_data_hash {
        Some(hash) if !hash.is_empty() => hash.clone(),
        _ => {
            util::message("ERROR: Client data hash is required for registration but not provided");
            return None;
        }
    };
    
    util::message(&format!("Registration request data - RP ID: {}, User ID: {} bytes, User name: {}, Client data hash: {} bytes, Algorithms: {:?}", 
        rpid, user_id.len(), user_name, client_data_hash.len(), context.supported_algorithms));
    
    let request = PasskeyRegistrationRequest {
        rp_id: rpid.to_string(),
        transaction_id: transaction_id.to_string(),
        user_id,
        user_name,
        client_data_hash,
        user_verification: context.user_verification.unwrap_or(false),
        supported_algorithms: context.supported_algorithms.clone(),
    };
    
    match serde_json::to_string(&request) {
        Ok(request_json) => {
            util::message(&format!("Sending registration request: {}", request_json));
            crate::ipc::send_passkey_request(RequestType::Registration, request_json, rpid)
        },
        Err(e) => {
            util::message(&format!("ERROR: Failed to serialize registration request: {}", e));
            None
        }
    }
}

/// Creates a WebAuthn make credential response from Bitwarden's registration response
pub unsafe fn create_make_credential_response(credential_id: Vec<u8>, attestation_object: Vec<u8>) -> std::result::Result<*mut ExperimentalWebAuthnPluginOperationResponse, HRESULT> {
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
    let response_layout = Layout::new::<ExperimentalWebAuthnPluginOperationResponse>();
    let operation_response_ptr = alloc(response_layout) as *mut ExperimentalWebAuthnPluginOperationResponse;
    if operation_response_ptr.is_null() {
        return Err(HRESULT(-1));
    }
    
    // Initialize the response
    ptr::write(operation_response_ptr, ExperimentalWebAuthnPluginOperationResponse {
        encoded_response_byte_count: response_len as u32,
        encoded_response_pointer: response_ptr,
    });
    
    Ok(operation_response_ptr)
}

