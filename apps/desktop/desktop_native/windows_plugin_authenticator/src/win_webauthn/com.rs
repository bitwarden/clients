//! Functions for interacting with Windows COM.

use std::{
    alloc,
    error::Error,
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

use crate::win_webauthn::types::{
    PluginCancelOperationRequest, PluginGetAssertionRequest, PluginLockStatus,
    PluginMakeCredentialRequest, WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    WEBAUTHN_PLUGIN_OPERATION_REQUEST, WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
};

use super::{ErrorKind, WinWebAuthnError};

static HANDLER: OnceLock<Arc<dyn PluginAuthenticator + Send + Sync>> = OnceLock::new();

#[implement(IClassFactory)]
pub struct Factory;

impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        _outer: windows::core::Ref<IUnknown>,
        iid: *const windows::core::GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> windows::core::Result<()> {
        let handler = match HANDLER.get() {
            Some(handler) => handler,
            None => {
                tracing::error!("Cannot create COM class object instance because the handler is not initialized. register_server() must be called before starting the COM server.");
                return Err(E_FAIL.into());
            }
        }.clone();
        let unknown: IInspectable = PluginAuthenticatorComObject { handler }.into();
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, _lock: windows::core::BOOL) -> windows::core::Result<()> {
        // TODO: Implement lock server
        Ok(())
    }
}

pub trait PluginAuthenticator {
    /// Process a request to create a new credential.
    ///
    /// Returns a [CTAP authenticatorMakeCredential response structure](https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#authenticatormakecredential-response-structure).
    fn make_credential(
        &self,
        request: PluginMakeCredentialRequest,
    ) -> Result<Vec<u8>, Box<dyn Error>>;

    /// Process a request to assert a credential.
    ///
    /// Returns a [CTAP authenticatorGetAssertion response structure](https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#authenticatorgetassertion-response-structure).
    fn get_assertion(&self, request: PluginGetAssertionRequest) -> Result<Vec<u8>, Box<dyn Error>>;

    /// Cancel an ongoing operation.
    fn cancel_operation(&self, request: PluginCancelOperationRequest)
        -> Result<(), Box<dyn Error>>;

    /// Retrieve lock status.
    fn lock_status(&self) -> Result<PluginLockStatus, Box<dyn Error>>;
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
    handler: Arc<dyn PluginAuthenticator + Send + Sync>,
}

impl IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn MakeCredential(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        tracing::debug!("MakeCredential called");
        // Convert to legacy format for internal processing
        if request.is_null() || response.is_null() {
            tracing::debug!("MakeCredential: Invalid request or response pointers passed");
            return HRESULT(-1);
        }
        // TODO: verify request signature
        return HRESULT(-1);

        /*
        match self.handler.make_credential(request) {
            Ok(response) => {
                // todo DECODE
                tracing::debug!("MakeCredential completed successfully");
                S_OK
            }
            Err(err) => {
                tracing::error!("MakeCredential failed: {err}");
                HRESULT(-1)
            }
        }
        */
    }

    unsafe fn GetAssertion(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        tracing::debug!("GetAssertion called");
        if request.is_null() || response.is_null() {
            tracing::warn!("GetAssertion called with invalid arguments");
            return E_INVALIDARG;
        }
        // TODO: verify request signature
        let assertion_request: PluginGetAssertionRequest =
            match NonNull::new(request as *mut WEBAUTHN_PLUGIN_OPERATION_REQUEST)
                .map(PluginGetAssertionRequest::try_from)
            {
                Some(Ok(assertion_request)) => assertion_request,
                Some(Err(err)) => {
                    tracing::error!("Could not deserialize GetAssertion request: {err}");
                    return E_FAIL;
                }
                None => {
                    tracing::warn!("GetOperation received null request");
                    return E_INVALIDARG;
                }
            };
        match self.handler.get_assertion(assertion_request) {
            Ok(assertion_response) => {
                let response = &mut *response;
                response.cbEncodedResponse = assertion_response.len() as u32;
                std::ptr::copy_nonoverlapping(
                    assertion_response.as_ptr(),
                    response.pbEncodedResponse,
                    assertion_response.len(),
                );
                tracing::error!("GetAssertion completed successfully");
                S_OK
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

/// Registers the plugin authenticator COM library with Windows.
pub(super) fn register_server<T>(clsid: &GUID, handler: T) -> Result<(), WinWebAuthnError>
where
    T: PluginAuthenticator + Send + Sync + 'static,
{
    // Store the handler as a static so it can be initialized
    HANDLER.set(Arc::new(handler)).map_err(|_| {
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
            // SAFETY: The pointer is valid and we are using a valid value for a byte-wise allocation.
            unsafe { ptr.write_bytes(0, size) };
        }

        Self(ptr.cast())
    }

    fn into_ptr<T>(self) -> *mut T {
        self.0.cast().as_ptr()
    }

    /// Creates a new COM-allocated structure.
    ///
    /// Note that `T` must be [Copy] to avoid any possible memory leaks.
    pub fn with_object<T: Copy>(object: T) -> *mut T {
        // NB: Vendored from Rust's alloc code since we can't yet allocate `Box` with a custom allocator.
        const MIN_ALIGN: usize = if cfg!(target_pointer_width = "64") {
            16
        } else if cfg!(target_pointer_width = "32") {
            8
        } else {
            panic!("unsupported arch")
        };

        // SAFETY: Validate that our alignment works for a normal size-based allocation for soundness.
        let layout = const {
            let layout = alloc::Layout::new::<T>();
            assert!(layout.align() <= MIN_ALIGN);
            layout
        };

        let buffer = Self::alloc(layout.size(), false);
        // SAFETY: `ptr` is valid for writes of `T` because we correctly allocated the right sized buffer that
        // accounts for any alignment requirements.
        //
        // Additionally, we ensure the value is treated as moved by forgetting the source.
        unsafe { buffer.0.cast::<T>().write(object) };
        buffer.into_ptr()
    }

    pub fn from_buffer<T: AsRef<[u8]>>(buffer: T) -> (*mut u8, u32) {
        let buffer = buffer.as_ref();
        let len = buffer.len();
        let com_buffer = Self::alloc(len, true);

        // SAFETY: `ptr` points to a valid allocation that `len` matches, and we made sure
        // the bytes were initialized. Additionally, bytes have no alignment requirements.
        unsafe {
            NonNull::slice_from_raw_parts(com_buffer.0.cast::<u8>(), len)
                .as_mut()
                .copy_from_slice(buffer)
        }

        // Safety: The Windows API structures these buffers are placed into use `u32` (`DWORD`) to
        // represent length.
        #[expect(clippy::as_conversions)]
        (com_buffer.into_ptr(), len as u32)
    }
}
