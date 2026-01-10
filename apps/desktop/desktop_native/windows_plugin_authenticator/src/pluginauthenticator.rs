/*
    This file exposes the functions and types defined here: https://github.com/microsoft/webauthn/blob/master/experimental/pluginauthenticator.h
*/

use windows::Win32::System::Com::*;
use windows_core::*;

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
pub unsafe trait EXPERIMENTAL_IPluginAuthenticator: IUnknown {
    fn EXPERIMENTAL_PluginMakeCredential(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        request: *const ExperimentalWebAuthnPluginOperationRequest,
        response: *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        request: *const ExperimentalWebAuthnPluginCancelOperationRequest,
    ) -> HRESULT;
}

#[implement(EXPERIMENTAL_IPluginAuthenticator)]
pub struct PluginAuthenticatorComObject;

#[implement(IClassFactory)]
pub struct Factory();

impl EXPERIMENTAL_IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn EXPERIMENTAL_PluginMakeCredential(
        &self,
        _request: *const ExperimentalWebAuthnPluginOperationRequest,
        _response: *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        _request: *const ExperimentalWebAuthnPluginOperationRequest,
        _response: *mut ExperimentalWebAuthnPluginOperationResponse,
    ) -> HRESULT {
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        _request: *const ExperimentalWebAuthnPluginCancelOperationRequest,
    ) -> HRESULT {
        HRESULT(0)
    }
}

impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        outer: Ref<IUnknown>,
        iid: *const GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> Result<()> {
        assert!(outer.is_null());
        let unknown: IInspectable = PluginAuthenticatorComObject.into();
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, lock: BOOL) -> Result<()> {
        assert!(lock.as_bool());
        Ok(())
    }
}
