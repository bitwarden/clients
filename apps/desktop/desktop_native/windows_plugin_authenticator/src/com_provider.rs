use windows::Win32::System::Com::*;
use windows_core::{implement, interface, IInspectable, IUnknown, Interface, HRESULT};
use std::ptr;

use crate::types::*;
use crate::utils::{self as util, wstr_to_string};
use crate::assert::{RequestContext, decode_get_assertion_request, create_get_assertion_response, send_assertion_request};
use crate::make_credential::{decode_make_credential_request, create_make_credential_response, send_registration_request};

/// Used when creating and asserting credentials.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_REQUEST
/// Header File Usage: EXPERIMENTAL_PluginMakeCredential()
///                    EXPERIMENTAL_PluginGetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginOperationRequest {
    pub window_handle: windows::Win32::Foundation::HWND,
    pub transaction_id: windows_core::GUID,
    pub request_signature_byte_count: u32,
    pub request_signature_pointer: *mut u8,
    pub encoded_request_byte_count: u32,
    pub encoded_request_pointer: *mut u8,
}

/// Used as a response when creating and asserting credentials.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_RESPONSE
/// Header File Usage: EXPERIMENTAL_PluginMakeCredential()
///                    EXPERIMENTAL_PluginGetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginOperationResponse {
    pub encoded_response_byte_count: u32,
    pub encoded_response_pointer: *mut u8,
}

/// Used to cancel an operation.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST
/// Header File Usage: EXPERIMENTAL_PluginCancelOperation()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginCancelOperationRequest {
    pub transaction_id: windows_core::GUID,
    pub request_signature_byte_count: u32,
    pub request_signature_pointer: *mut u8,
}

#[interface("e6466e9a-b2f3-47c5-b88d-89bc14a8d998")]
pub unsafe trait EXPERIMENTAL_IPluginAuthenticator: windows_core::IUnknown {
    fn EXPERIMENTAL_PluginMakeCredential(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        request: *const ExperimentalWebAuthnPluginCancelOperationRequest,
    ) -> HRESULT;
}

#[implement(EXPERIMENTAL_IPluginAuthenticator)]
pub struct PluginAuthenticatorComObject;

#[implement(IClassFactory)]
pub struct Factory;

impl EXPERIMENTAL_IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn EXPERIMENTAL_PluginMakeCredential(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        util::message("=== EXPERIMENTAL_PluginMakeCredential() called ===");
        
        if request.is_null() {
            util::message("ERROR: NULL request pointer");
            return HRESULT(-1);
        }
        
        if response.is_null() {
            util::message("ERROR: NULL response pointer");
            return HRESULT(-1);
        }
        
        let req = &*request;
        let transaction_id = format!("{:?}", req.transaction_id);
        
        util::message(&format!("Transaction ID: {}", transaction_id));
        util::message(&format!("Window Handle: {:?}", req.window_handle));
        util::message(&format!("Request Signature Byte Count: {}", req.request_signature_byte_count));
        util::message(&format!("Encoded Request Byte Count: {}", req.encoded_request_byte_count));
        
        if req.encoded_request_byte_count == 0 || req.encoded_request_pointer.is_null() {
            util::message("ERROR: No encoded request data provided");
            return HRESULT(-1);
        }
        
        let encoded_request_slice = std::slice::from_raw_parts(
            req.encoded_request_pointer, 
            req.encoded_request_byte_count as usize
        );
        
        util::message(&format!("Encoded request: {} bytes", encoded_request_slice.len()));
        
        // Try to decode the request using Windows API
        match decode_make_credential_request(encoded_request_slice) {
            Ok(decoded_wrapper) => {
                let decoded_request = decoded_wrapper.as_ref();
                util::message("Successfully decoded make credential request using Windows API");
                
                // Extract RP information
                if decoded_request.pRpInformation.is_null() {
                    util::message("ERROR: RP information is null");
                    return HRESULT(-1);
                }
                
                let rp_info = &*decoded_request.pRpInformation;
                
                let rpid = if rp_info.pwszId.is_null() {
                    util::message("ERROR: RP ID is null");
                    return HRESULT(-1);
                } else {
                    match wstr_to_string(rp_info.pwszId) {
                        Ok(id) => id,
                        Err(e) => {
                            util::message(&format!("ERROR: Failed to decode RP ID: {}", e));
                            return HRESULT(-1);
                        }
                    }
                };
                
                let rp_name = if rp_info.pwszName.is_null() {
                    String::new()
                } else {
                    wstr_to_string(rp_info.pwszName).unwrap_or_default()
                };
                
                // Extract user information
                if decoded_request.pUserInformation.is_null() {
                    util::message("ERROR: User information is null");
                    return HRESULT(-1);
                }
                
                let user = &*decoded_request.pUserInformation;
                
                let user_id = if user.pbId.is_null() || user.cbId == 0 {
                    util::message("ERROR: User ID is required for registration");
                    return HRESULT(-1);
                } else {
                    let id_slice = std::slice::from_raw_parts(user.pbId, user.cbId as usize);
                    id_slice.to_vec()
                };
                
                let user_name = if user.pwszName.is_null() {
                    util::message("ERROR: User name is required for registration");
                    return HRESULT(-1);
                } else {
                    match wstr_to_string(user.pwszName) {
                        Ok(name) => name,
                        Err(_) => {
                            util::message("ERROR: Failed to decode user name");
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
                let client_data_hash = if decoded_request.cbClientDataHash == 0 || decoded_request.pbClientDataHash.is_null() {
                    util::message("ERROR: Client data hash is required for registration");
                    return HRESULT(-1);
                } else {
                    let hash_slice = std::slice::from_raw_parts(
                        decoded_request.pbClientDataHash, 
                        decoded_request.cbClientDataHash as usize
                    );
                    hash_slice.to_vec()
                };
                
                // Extract RP ID raw bytes for authenticator data
                let rpid_bytes = if decoded_request.cbRpId > 0 && !decoded_request.pbRpId.is_null() {
                    let rpid_slice = std::slice::from_raw_parts(
                        decoded_request.pbRpId,
                        decoded_request.cbRpId as usize
                    );
                    rpid_slice.to_vec()
                } else {
                    rpid.as_bytes().to_vec()
                };
                
                // Extract supported algorithms
                let supported_algorithms = if decoded_request.WebAuthNCredentialParameters.cCredentialParameters > 0 && 
                                            !decoded_request.WebAuthNCredentialParameters.pCredentialParameters.is_null() {
                    let params_count = decoded_request.WebAuthNCredentialParameters.cCredentialParameters as usize;
                    let params_ptr = decoded_request.WebAuthNCredentialParameters.pCredentialParameters;
                    
                    (0..params_count)
                        .map(|i| unsafe { &*params_ptr.add(i) }.lAlg)
                        .collect()
                } else {
                    Vec::new()
                };
                
                // Create request context from properly decoded data
                let mut request_context = RequestContext::default();
                request_context.rpid = Some(rpid.clone());
                request_context.user_id = Some(user_info.0);
                request_context.user_name = Some(user_info.1);
                request_context.user_display_name = user_info.2;
                request_context.client_data_hash = Some(client_data_hash);
                request_context.supported_algorithms = supported_algorithms;
                
                util::message(&format!("Make credential request - RP: {}, User: {}", 
                    rpid, 
                    request_context.user_name.as_deref().unwrap_or("unknown")));
                
                // Send registration request
                if let Some(passkey_response) = send_registration_request(&rpid, &transaction_id, &request_context) {
                    util::message(&format!("Registration response received: {:?}", passkey_response));
                    
                    // Create proper WebAuthn response from passkey_response
                    match passkey_response {
                        PasskeyResponse::RegistrationResponse { credential_id, attestation_object } => {
                            util::message("Creating WebAuthn make credential response");
                            
                            match create_make_credential_response(credential_id, attestation_object) {
                                Ok(webauthn_response) => {
                                    util::message("Successfully created WebAuthn response");
                                    *response = webauthn_response;
                                    HRESULT(0)
                                },
                                Err(e) => {
                                    util::message(&format!("ERROR: Failed to create WebAuthn response: {}", e));
                                    *response = ptr::null_mut();
                                    HRESULT(-1)
                                }
                            }
                        },
                        PasskeyResponse::Error { message } => {
                            util::message(&format!("Registration request failed: {}", message));
                            *response = ptr::null_mut();
                            HRESULT(-1)
                        },
                        _ => {
                            util::message("ERROR: Unexpected response type for registration request");
                            *response = ptr::null_mut();
                            HRESULT(-1)
                        }
                    }
                } else {
                    util::message("ERROR: No response from registration request");
                    *response = ptr::null_mut();
                    HRESULT(-1)
                }
            },
            Err(e) => {
                util::message(&format!("ERROR: Failed to decode make credential request: {}", e));
                *response = ptr::null_mut();
                HRESULT(-1)
            }
        }
    }

    unsafe fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        util::message("EXPERIMENTAL_PluginGetAssertion() called");
        
        // Validate input parameters
        if request.is_null() || response.is_null() {
            util::message("Invalid parameters passed to EXPERIMENTAL_PluginGetAssertion");
            return HRESULT(-1);
        }
        
        let req = &*request;
        let transaction_id = format!("{:?}", req.transaction_id);
        
        util::message(&format!("Get assertion request - Transaction: {}", transaction_id));
        
        if req.encoded_request_byte_count == 0 || req.encoded_request_pointer.is_null() {
            util::message("ERROR: No encoded request data provided");
            *response = ptr::null_mut();
            return HRESULT(-1);
        }
        
        let encoded_request_slice = std::slice::from_raw_parts(
            req.encoded_request_pointer, 
            req.encoded_request_byte_count as usize
        );
        
        // Try to decode the request using Windows API
        match decode_get_assertion_request(encoded_request_slice) {
            Ok(decoded_wrapper) => {
                let decoded_request = decoded_wrapper.as_ref();
                util::message("Successfully decoded get assertion request using Windows API");
                
                // Extract RP information
                let rpid = if decoded_request.pwszRpId.is_null() {
                    util::message("ERROR: RP ID is null");
                    *response = ptr::null_mut();
                    return HRESULT(-1);
                } else {
                    match wstr_to_string(decoded_request.pwszRpId) {
                        Ok(id) => id,
                        Err(e) => {
                            util::message(&format!("ERROR: Failed to decode RP ID: {}", e));
                            *response = ptr::null_mut();
                            return HRESULT(-1);
                        }
                    }
                };
                
                // Extract client data hash
                let client_data_hash = if decoded_request.cbClientDataHash == 0 || decoded_request.pbClientDataHash.is_null() {
                    util::message("ERROR: Client data hash is required for assertion");
                    *response = ptr::null_mut();
                    return HRESULT(-1);
                } else {
                    let hash_slice = std::slice::from_raw_parts(
                        decoded_request.pbClientDataHash, 
                        decoded_request.cbClientDataHash as usize
                    );
                    hash_slice.to_vec()
                };
                
                // Create request context from properly decoded data
                let mut request_context = RequestContext::default();
                request_context.rpid = Some(rpid.clone());
                request_context.client_data_hash = Some(client_data_hash);
                // TODO: Extract allowed credentials from CredentialList if available
                
                util::message(&format!("Get assertion request - RP: {}", rpid));
                
                // Send assertion request
                if let Some(passkey_response) = send_assertion_request(&rpid, &transaction_id, &request_context) {
                    util::message(&format!("Assertion response received: {:?}", passkey_response));
                    
                    // Create proper WebAuthn response from passkey_response
                    match passkey_response {
                        PasskeyResponse::AssertionResponse { credential_id, authenticator_data, signature, user_handle } => {
                            util::message("Creating WebAuthn get assertion response");
                            
                            match create_get_assertion_response(credential_id, authenticator_data, signature, user_handle) {
                                Ok(webauthn_response) => {
                                    util::message("Successfully created WebAuthn assertion response");
                                    *response = webauthn_response;
                                    HRESULT(0)
                                },
                                Err(e) => {
                                    util::message(&format!("ERROR: Failed to create WebAuthn assertion response: {}", e));
                                    *response = ptr::null_mut();
                                    HRESULT(-1)
                                }
                            }
                        },
                        PasskeyResponse::Error { message } => {
                            util::message(&format!("Assertion request failed: {}", message));
                            *response = ptr::null_mut();
                            HRESULT(-1)
                        },
                        _ => {
                            util::message("ERROR: Unexpected response type for assertion request");
                            *response = ptr::null_mut();
                            HRESULT(-1)
                        }
                    }
                } else {
                    util::message("ERROR: No response from assertion request");
                    *response = ptr::null_mut();
                    HRESULT(-1)
                }
            },
            Err(e) => {
                util::message(&format!("ERROR: Failed to decode get assertion request: {}", e));
                *response = ptr::null_mut();
                HRESULT(-1)
            }
        }
    }

    unsafe fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        request: *const ExperimentalWebAuthnPluginCancelOperationRequest,
    ) -> HRESULT {
        util::message("EXPERIMENTAL_PluginCancelOperation() called");
        HRESULT(0)
    }
}

impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        outer: windows_core::Ref<IUnknown>,
        iid: *const windows_core::GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> windows_core::Result<()> {
        let unknown: IInspectable = PluginAuthenticatorComObject.into();    // TODO: IUnknown ?
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, lock: windows_core::BOOL) -> windows_core::Result<()> {
        Ok(())
    }
}