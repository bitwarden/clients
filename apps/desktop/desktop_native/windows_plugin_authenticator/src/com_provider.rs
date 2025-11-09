use windows::Win32::Foundation::{RECT, S_OK};
use windows::Win32::System::Com::*;
use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;
use windows_core::{implement, interface, IInspectable, IUnknown, Interface, HRESULT};

use crate::assert::plugin_get_assertion;
use crate::ipc2::WindowsProviderClient;
use crate::make_credential::plugin_make_credential;
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
/// Header File Name: _WEBAUTHN_PLUGIN_OPERATION_REQUEST
/// Header File Usage: MakeCredential()
///                    GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnPluginOperationRequest {
    pub window_handle: windows::Win32::Foundation::HWND,
    pub transaction_id: windows_core::GUID,
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

/// Used to cancel an operation.
/// Header File Name: _WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST
/// Header File Usage: CancelOperation()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnPluginCancelOperationRequest {
    pub transaction_id: windows_core::GUID,
    pub request_signature_byte_count: u32,
    pub request_signature_pointer: *mut u8,
}

// Stable IPluginAuthenticator interface
#[interface("d26bcf6f-b54c-43ff-9f06-d5bf148625f7")]
pub unsafe trait IPluginAuthenticator: windows_core::IUnknown {
    fn MakeCredential(
        &self,
        request: *const WebAuthnPluginOperationRequest,
        response: *mut WebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn GetAssertion(
        &self,
        request: *const WebAuthnPluginOperationRequest,
        response: *mut WebAuthnPluginOperationResponse,
    ) -> HRESULT;
    fn CancelOperation(&self, request: *const WebAuthnPluginCancelOperationRequest) -> HRESULT;
    fn GetLockStatus(&self, lock_status: *mut PluginLockStatus) -> HRESULT;
}

pub unsafe fn parse_credential_list(credential_list: &WEBAUTHN_CREDENTIAL_LIST) -> Vec<Vec<u8>> {
    let mut allowed_credentials = Vec::new();

    if credential_list.cCredentials == 0 || credential_list.ppCredentials.is_null() {
        tracing::debug!("No credentials in credential list");
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
            tracing::debug!("WARNING: Credential {} is null, skipping", i);
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
        // For some reason, we're getting hex strings from Windows instead of bytes.
        let credential_id_slice =
            std::slice::from_raw_parts(credential.pbId, credential.cbId as usize);

        debug_log(&format!(
            "Parsed credential {}: {} bytes, {:?}",
            i, credential.cbId, &credential_id_slice,
        ));
        allowed_credentials.push(credential_id_slice.to_vec());
    }

    debug_log(&format!(
        "Successfully parsed {} allowed credentials",
        allowed_credentials.len()
    ));
    allowed_credentials
}

#[implement(IPluginAuthenticator)]
pub struct PluginAuthenticatorComObject {
    client: WindowsProviderClient,
}

#[implement(IClassFactory)]
pub struct Factory;

impl IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn MakeCredential(
        &self,
        request: *const WebAuthnPluginOperationRequest,
        response: *mut WebAuthnPluginOperationResponse,
    ) -> HRESULT {
        tracing::debug!("MakeCredential() called");
        tracing::debug!("version2");
        // Convert to legacy format for internal processing
        if request.is_null() || response.is_null() {
            tracing::debug!("MakeCredential: Invalid request or response pointers passed");
            return HRESULT(-1);
        }

        match plugin_make_credential(&self.client, request, response) {
            Ok(()) => S_OK,
            Err(err) => err,
        }
    }

    unsafe fn GetAssertion(
        &self,
        request: *const WebAuthnPluginOperationRequest,
        response: *mut WebAuthnPluginOperationResponse,
    ) -> HRESULT {
        tracing::debug!("GetAssertion() called");
        if request.is_null() || response.is_null() {
            return HRESULT(-1);
        }

        match plugin_get_assertion(&self.client, request, response) {
            Ok(()) => S_OK,
            Err(err) => err,
        }
    }

    unsafe fn CancelOperation(
        &self,
        _request: *const WebAuthnPluginCancelOperationRequest,
    ) -> HRESULT {
        tracing::debug!("CancelOperation() called");
        HRESULT(0)
    }

    unsafe fn GetLockStatus(&self, lock_status: *mut PluginLockStatus) -> HRESULT {
        tracing::debug!("GetLockStatus() called");
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
        tracing::debug!("Creating COM server instance.");
        tracing::debug!("Trying to connect to Bitwarden IPC");
        let client = WindowsProviderClient::connect();
        tracing::debug!("Connected to Bitwarden IPC");
        let unknown: IInspectable = PluginAuthenticatorComObject { client }.into(); // TODO: IUnknown ?
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, _lock: windows_core::BOOL) -> windows_core::Result<()> {
        Ok(())
    }
}
