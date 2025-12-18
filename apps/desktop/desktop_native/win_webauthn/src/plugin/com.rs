//! Functions for interacting with Windows COM.
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::{
    alloc,
    mem::MaybeUninit,
    ptr::{self, NonNull},
    sync::{Arc, OnceLock},
};

use windows::{
    core::{implement, interface, ComObjectInterface, IUnknown, GUID, HRESULT},
    Win32::{
        Foundation::{E_FAIL, E_INVALIDARG, S_OK},
        System::Com::*,
    },
};
use windows_core::{IInspectable, Interface};

use super::{
    types::{
        PluginLockStatus, WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
        WEBAUTHN_PLUGIN_OPERATION_REQUEST, WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    },
    PluginAuthenticator,
};
use crate::{
    plugin::{crypto, PluginGetAssertionRequest, PluginMakeCredentialRequest},
    ErrorKind, WinWebAuthnError,
};

static HANDLER: OnceLock<(GUID, Arc<dyn PluginAuthenticator + Send + Sync>)> = OnceLock::new();

#[implement(IClassFactory)]
pub struct Factory;

impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        _outer: windows::core::Ref<IUnknown>,
        iid: *const windows::core::GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> windows::core::Result<()> {
        let (clsid, handler) = match HANDLER.get() {
            Some(state) => state,
            None => {
                tracing::error!("Cannot create COM class object instance because the handler is not initialized. register_server() must be called before starting the COM server.");
                return Err(E_FAIL.into());
            }
        }.clone();
        let unknown: IInspectable = PluginAuthenticatorComObject { clsid, handler }.into();
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, _lock: windows::core::BOOL) -> windows::core::Result<()> {
        // TODO: Implement lock server
        Ok(())
    }
}

// IPluginAuthenticator interface
#[interface("d26bcf6f-b54c-43ff-9f06-d5bf148625f7")]
pub unsafe trait IPluginAuthenticator: windows::core::IUnknown {
    fn MakeCredential(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT;
    fn GetAssertion(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT;
    fn CancelOperation(&self, request: *const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST) -> HRESULT;
    fn GetLockStatus(&self, lock_status: *mut PluginLockStatus) -> HRESULT;
}

#[implement(IPluginAuthenticator)]
struct PluginAuthenticatorComObject {
    clsid: GUID,
    handler: Arc<dyn PluginAuthenticator + Send + Sync>,
}

impl IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn MakeCredential(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        tracing::debug!("MakeCredential called");
        let response = match NonNull::new(response) {
            Some(p) => p,
            None => {
                tracing::warn!(
                    "MakeCredential called with null response pointer from Windows. Aborting request."
                );
                return E_INVALIDARG;
            }
        };
        let op_request_ptr = match NonNull::new(request.cast_mut()) {
            Some(p) => p,
            None => {
                tracing::warn!(
                    "MakeCredential called with null request pointer from Windows. Aborting request."
                );
                return E_INVALIDARG;
            }
        };

        if let Err(err) = verify_operation_request(op_request_ptr.as_ref(), &self.clsid) {
            tracing::error!("Failed to verify request signature: {err}");
            return E_INVALIDARG;
        }

        // SAFETY: we received the pointer from Windows, so we trust that the values are set
        // properly.
        let registration_request = match PluginMakeCredentialRequest::try_from_ptr(op_request_ptr) {
            Ok(r) => r,
            Err(err) => {
                tracing::error!("Could not deserialize MakeCredential request: {err}");
                return E_FAIL;
            }
        };
        match self.handler.make_credential(registration_request) {
            Ok(registration_response) => {
                // SAFETY: response pointer was given to us by Windows, so we assume it's valid.
                match write_operation_response(&registration_response, response) {
                    Ok(()) => {
                        tracing::debug!("MakeCredential completed successfully");
                        S_OK
                    }
                    Err(err) => {
                        tracing::error!(
                            "Failed to write MakeCredential response to Windows: {err}"
                        );
                        return E_FAIL;
                    }
                }
            }
            Err(err) => {
                tracing::error!("MakeCredential failed: {err}");
                E_FAIL
            }
        }
    }

    unsafe fn GetAssertion(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        tracing::debug!("GetAssertion called");
        let response = match NonNull::new(response) {
            Some(p) => p,
            None => {
                tracing::warn!(
                    "GetAssertion called with null response pointer from Windows. Aborting request."
                );
                return E_INVALIDARG;
            }
        };
        let op_request_ptr = match NonNull::new(request.cast_mut()) {
            Some(p) => p,
            None => {
                tracing::warn!(
                    "GetAssertion called with null request pointer from Windows. Aborting request."
                );
                return E_INVALIDARG;
            }
        };

        if let Err(err) = verify_operation_request(op_request_ptr.as_ref(), &self.clsid) {
            tracing::error!("Failed to verify request signature: {err}");
            return E_INVALIDARG;
        }

        let assertion_request = match PluginGetAssertionRequest::try_from_ptr(op_request_ptr) {
            Ok(assertion_request) => assertion_request,
            Err(err) => {
                tracing::error!("Could not deserialize GetAssertion request: {err}");
                return E_FAIL;
            }
        };
        match self.handler.get_assertion(assertion_request) {
            Ok(assertion_response) => {
                // SAFETY: response pointer was given to us by Windows, so we assume it's valid.
                match write_operation_response(&assertion_response, response) {
                    Ok(()) => {
                        tracing::debug!("GetAssertion completed successfully");
                        S_OK
                    }
                    Err(err) => {
                        tracing::error!("Failed to write GetCredential response to Windows: {err}");
                        return E_FAIL;
                    }
                }
            }
            Err(err) => {
                tracing::error!("GetAssertion failed: {err}");
                E_FAIL
            }
        }
    }

    unsafe fn CancelOperation(
        &self,
        request: *const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    ) -> HRESULT {
        tracing::debug!("CancelOperation called");
        let request = match NonNull::new(request as *mut WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST) {
            Some(request) => request,
            None => {
                tracing::warn!("Received null CancelOperation request");
                return E_INVALIDARG;
            }
        };

        match self.handler.cancel_operation(request.into()) {
            Ok(()) => {
                tracing::error!("CancelOperation completed successfully");
                S_OK
            }
            Err(err) => {
                tracing::error!("CancelOperation failed: {err}");
                E_FAIL
            }
        }
    }

    unsafe fn GetLockStatus(&self, lock_status: *mut PluginLockStatus) -> HRESULT {
        tracing::debug!(
            "GetLockStatus() called <PID {}, Thread {:?}>",
            std::process::id(),
            std::thread::current().id()
        );
        if lock_status.is_null() {
            return HRESULT(-2147024809); // E_INVALIDARG
        }

        match self.handler.lock_status() {
            Ok(status) => {
                tracing::debug!("GetLockStatus received {status:?}");
                *lock_status = status;
                S_OK
            }
            Err(err) => {
                tracing::error!("GetLockStatus failed: {err}");
                E_FAIL
            }
        }
    }
}

/// Copies data as COM-allocated buffer and writes to response pointer.
///
/// Safety constraints: [response] must point to a valid
/// WEBAUTHN_PLUGIN_OPERATION_RESPONSE struct.
unsafe fn write_operation_response(
    data: &[u8],
    response: NonNull<WEBAUTHN_PLUGIN_OPERATION_RESPONSE>,
) -> Result<(), WinWebAuthnError> {
    let len = match data.len().try_into() {
        Ok(len) => len,
        Err(err) => {
            return Err(WinWebAuthnError::with_cause(
                ErrorKind::Serialization,
                "Response is too long to return to OS",
                err,
            ));
        }
    };
    let buf = data.to_com_buffer();

    response.write(WEBAUTHN_PLUGIN_OPERATION_RESPONSE {
        cbEncodedResponse: len,
        pbEncodedResponse: buf.leak(),
    });
    Ok(())
}

/// Registers the plugin authenticator COM library with Windows.
pub(super) fn register_server<T>(clsid: &GUID, handler: T) -> Result<(), WinWebAuthnError>
where
    T: PluginAuthenticator + Send + Sync + 'static,
{
    // Store the handler as a static so it can be initialized
    HANDLER.set((*clsid, Arc::new(handler))).map_err(|_| {
        WinWebAuthnError::new(ErrorKind::WindowsInternal, "Handler already initialized")
    })?;

    static FACTORY: windows::core::StaticComObject<Factory> = Factory.into_static();
    unsafe {
        CoRegisterClassObject(
            ptr::from_ref(clsid),
            FACTORY.as_interface_ref(),
            CLSCTX_LOCAL_SERVER,
            REGCLS_MULTIPLEUSE,
        )
    }
    .map_err(|err| {
        WinWebAuthnError::with_cause(
            ErrorKind::WindowsInternal,
            "Couldn't register the COM library with Windows",
            err,
        )
    })?;
    Ok(())
}

/// Initializes the COM library for use on the calling thread,
/// and registers + sets the security values.
pub(super) fn initialize() -> std::result::Result<(), WinWebAuthnError> {
    let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };

    if result.is_err() {
        return Err(WinWebAuthnError::with_cause(
            ErrorKind::WindowsInternal,
            "Could not initialize the COM library",
            windows::core::Error::from_hresult(result),
        ));
    }

    unsafe {
        CoInitializeSecurity(
            None,
            -1,
            None,
            None,
            RPC_C_AUTHN_LEVEL_DEFAULT,
            RPC_C_IMP_LEVEL_IMPERSONATE,
            None,
            EOAC_NONE,
            None,
        )
    }
    .map_err(|err| {
        WinWebAuthnError::with_cause(
            ErrorKind::WindowsInternal,
            "Could not initialize COM security",
            err,
        )
    })
}

pub(super) fn uninitialize() -> std::result::Result<(), WinWebAuthnError> {
    unsafe { CoUninitialize() };
    Ok(())
}

#[repr(transparent)]
pub(super) struct ComBuffer(NonNull<MaybeUninit<u8>>);

impl ComBuffer {
    /// Returns an COM-allocated buffer of `size`.
    fn alloc(size: usize, for_slice: bool) -> Self {
        #[expect(clippy::as_conversions)]
        {
            assert!(size <= isize::MAX as usize, "requested bad object size");
        }

        // SAFETY: Any size is valid to pass to Windows, even `0`.
        let ptr = NonNull::new(unsafe { CoTaskMemAlloc(size) }).unwrap_or_else(|| {
            // XXX: This doesn't have to be correct, just close enough for an OK OOM error.
            let layout = alloc::Layout::from_size_align(size, align_of::<u8>()).unwrap();
            alloc::handle_alloc_error(layout)
        });

        if for_slice {
            // Ininitialize the buffer so it can later be treated as `&mut [u8]`.
            // SAFETY: The pointer is valid and we are using a valid value for a byte-wise
            // allocation.
            unsafe { ptr.write_bytes(0, size) };
        }

        Self(ptr.cast())
    }

    pub fn leak<T>(self) -> *mut T {
        self.0.cast().as_ptr()
    }
}

pub(super) trait ComBufferExt {
    fn to_com_buffer(&self) -> ComBuffer;
}

impl ComBufferExt for Vec<u8> {
    fn to_com_buffer(&self) -> ComBuffer {
        ComBuffer::from(&self)
    }
}

impl ComBufferExt for &[u8] {
    fn to_com_buffer(&self) -> ComBuffer {
        ComBuffer::from(self)
    }
}

impl ComBufferExt for Vec<u16> {
    fn to_com_buffer(&self) -> ComBuffer {
        let buffer: Vec<u8> = self.into_iter().flat_map(|x| x.to_le_bytes()).collect();
        ComBuffer::from(&buffer)
    }
}

impl ComBufferExt for &[u16] {
    fn to_com_buffer(&self) -> ComBuffer {
        let buffer: Vec<u8> = self
            .as_ref()
            .into_iter()
            .flat_map(|x| x.to_le_bytes())
            .collect();
        ComBuffer::from(&buffer)
    }
}

impl<T: AsRef<[u8]>> From<T> for ComBuffer {
    fn from(value: T) -> Self {
        let buffer: Vec<u8> = value
            .as_ref()
            .into_iter()
            .flat_map(|x| x.to_le_bytes())
            .collect();
        let len = buffer.len();
        let com_buffer = Self::alloc(len, true);
        // SAFETY: `ptr` points to a valid allocation that `len` matches, and we made sure
        // the bytes were initialized. Additionally, bytes have no alignment requirements.
        unsafe {
            NonNull::slice_from_raw_parts(com_buffer.0.cast::<u8>(), len)
                .as_mut()
                .copy_from_slice(&buffer);
        }
        com_buffer
    }
}

unsafe fn verify_operation_request(
    request: &WEBAUTHN_PLUGIN_OPERATION_REQUEST,
    clsid: &GUID,
) -> Result<(), WinWebAuthnError> {
    // Verify request
    tracing::debug!("Verifying request");
    let request_data =
        std::slice::from_raw_parts(request.pbEncodedRequest, request.cbEncodedRequest as usize);
    let request_hash = crypto::hash_sha256(request_data).map_err(|err| {
        WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "failed to hash request", err)
    })?;
    let signature = std::slice::from_raw_parts(
        request.pbRequestSignature,
        request.cbRequestSignature as usize,
    );
    tracing::debug!("Retrieving signing key");
    let op_pub_key = crypto::get_operation_signing_public_key(clsid).map_err(|err| {
        WinWebAuthnError::with_cause(
            ErrorKind::WindowsInternal,
            "Failed to get signing key for operation",
            err,
        )
    })?;
    tracing::debug!("Verifying signature");
    op_pub_key.verify_signature(&request_hash, signature)
}
