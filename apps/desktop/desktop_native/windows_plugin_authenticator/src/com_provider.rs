use std::ptr;
use windows::Win32::System::Com::*;
use windows_core::{implement, interface, IInspectable, IUnknown, Interface, HRESULT};

use crate::assert::experimental_plugin_get_assertion;
use crate::make_credential::experimental_plugin_make_credential;
use crate::util::debug_log;
use crate::webauthn::WEBAUTHN_CREDENTIAL_LIST;

/// Plugin request type enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum WebAuthnPluginRequestType {
    CTAP2_CBOR = 0x01,
}

/// Plugin lock status enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum PluginLockStatus {
    PluginLocked = 0,
    PluginUnlocked = 1,
}

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

/// Used when creating and asserting credentials with EXPERIMENTAL2 interface.
/// Header File Name: _EXPERIMENTAL2_WEBAUTHN_PLUGIN_OPERATION_REQUEST
/// Header File Usage: EXPERIMENTAL_MakeCredential()
///                    EXPERIMENTAL_GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct Experimental2WebAuthnPluginOperationRequest {
    pub window_handle: windows::Win32::Foundation::HWND,
    pub transaction_id: windows_core::GUID,
    pub request_signature_byte_count: u32,
    pub request_signature_pointer: *mut u8,
    pub request_type: WebAuthnPluginRequestType,
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
    fn EXPERIMENTAL_GetLockStatus(
        &self,
        lock_status: *mut PluginLockStatus,
    ) -> HRESULT;
}

#[interface("d26bcf6f-b54c-43ff-9f06-d5bf148625f7")]
pub unsafe trait EXPERIMENTAL2_IPluginAuthenticator: windows_core::IUnknown {
    fn EXPERIMENTAL_MakeCredential(
        &self,
        request: *const Experimental2WebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn EXPERIMENTAL_GetAssertion(
        &self,
        request: *const Experimental2WebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn EXPERIMENTAL_CancelOperation(
        &self,
        request: *const ExperimentalWebAuthnPluginCancelOperationRequest,
    ) -> HRESULT;
    fn EXPERIMENTAL_GetLockStatus(
        &self,
        lock_status: *mut PluginLockStatus,
    ) -> HRESULT;
}


pub unsafe fn parse_credential_list(credential_list: &WEBAUTHN_CREDENTIAL_LIST) -> Vec<Vec<u8>> {
    let mut allowed_credentials = Vec::new();

    if credential_list.cCredentials == 0 || credential_list.ppCredentials.is_null() {
        debug_log("No credentials in credential list");
        return allowed_credentials;
    }

    debug_log(&format!(
        "Parsing {} credentials from credential list",
        credential_list.cCredentials
    ));

    // ppCredentials is an array of pointers to WEBAUTHN_CREDENTIAL_EX
    let credentials_array = std::slice::from_raw_parts(
        credential_list.ppCredentials,
        credential_list.cCredentials as usize,
    );

    for (i, &credential_ptr) in credentials_array.iter().enumerate() {
        if credential_ptr.is_null() {
            debug_log(&format!("WARNING: Credential {} is null, skipping", i));
            continue;
        }

        let credential = &*credential_ptr;

        if credential.cbId == 0 || credential.pbId.is_null() {
            debug_log(&format!(
                "WARNING: Credential {} has invalid ID, skipping",
                i
            ));
            continue;
        }

        // Extract credential ID bytes
        let credential_id_slice =
            std::slice::from_raw_parts(credential.pbId, credential.cbId as usize);

        allowed_credentials.push(credential_id_slice.to_vec());
        debug_log(&format!(
            "Parsed credential {}: {} bytes",
            i, credential.cbId
        ));
    }

    debug_log(&format!(
        "Successfully parsed {} allowed credentials",
        allowed_credentials.len()
    ));
    allowed_credentials
}

#[implement(EXPERIMENTAL_IPluginAuthenticator, EXPERIMENTAL2_IPluginAuthenticator)]
pub struct PluginAuthenticatorComObject;

#[implement(IClassFactory)]
pub struct Factory;

impl EXPERIMENTAL_IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn EXPERIMENTAL_PluginMakeCredential(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        experimental_plugin_make_credential(request, response)
    }

    unsafe fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        experimental_plugin_get_assertion(request, response)
    }

    unsafe fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        _request: *const ExperimentalWebAuthnPluginCancelOperationRequest,
    ) -> HRESULT {
        debug_log("EXPERIMENTAL_PluginCancelOperation() called");
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_GetLockStatus(
        &self,
        lock_status: *mut PluginLockStatus,
    ) -> HRESULT {
        debug_log("EXPERIMENTAL_GetLockStatus() called");
        if lock_status.is_null() {
            return HRESULT(-2147024809); // E_INVALIDARG
        }
        *lock_status = PluginLockStatus::PluginUnlocked;
        HRESULT(0)
    }
}

impl EXPERIMENTAL2_IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn EXPERIMENTAL_MakeCredential(
        &self,
        request: *const Experimental2WebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        debug_log("EXPERIMENTAL2_MakeCredential() called");
        let legacy_request = ExperimentalWebAuthnPluginOperationRequest {
            window_handle: (*request).window_handle,
            transaction_id: (*request).transaction_id,
            request_signature_byte_count: (*request).request_signature_byte_count,
            request_signature_pointer: (*request).request_signature_pointer,
            encoded_request_byte_count: (*request).encoded_request_byte_count,
            encoded_request_pointer: (*request).encoded_request_pointer,
        };
        experimental_plugin_make_credential(&legacy_request, response)
    }

    unsafe fn EXPERIMENTAL_GetAssertion(
        &self,
        request: *const Experimental2WebAuthnPluginOperationRequest,
        response: *mut *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        debug_log("EXPERIMENTAL2_GetAssertion() called");
        let legacy_request = ExperimentalWebAuthnPluginOperationRequest {
            window_handle: (*request).window_handle,
            transaction_id: (*request).transaction_id,
            request_signature_byte_count: (*request).request_signature_byte_count,
            request_signature_pointer: (*request).request_signature_pointer,
            encoded_request_byte_count: (*request).encoded_request_byte_count,
            encoded_request_pointer: (*request).encoded_request_pointer,
        };
        experimental_plugin_get_assertion(&legacy_request, response)
    }

    unsafe fn EXPERIMENTAL_CancelOperation(
        &self,
        _request: *const ExperimentalWebAuthnPluginCancelOperationRequest,
    ) -> HRESULT {
        debug_log("EXPERIMENTAL2_CancelOperation() called");
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_GetLockStatus(
        &self,
        lock_status: *mut PluginLockStatus,
    ) -> HRESULT {
        debug_log("EXPERIMENTAL2_GetLockStatus() called");
        if lock_status.is_null() {
            return HRESULT(-2147024809); // E_INVALIDARG
        }
        *lock_status = PluginLockStatus::PluginUnlocked;
        HRESULT(0)
    }
}


impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        _outer: windows_core::Ref<IUnknown>,
        iid: *const windows_core::GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> windows_core::Result<()> {
        let unknown: IInspectable = PluginAuthenticatorComObject.into(); // TODO: IUnknown ?
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, _lock: windows_core::BOOL) -> windows_core::Result<()> {
        Ok(())
    }
}
