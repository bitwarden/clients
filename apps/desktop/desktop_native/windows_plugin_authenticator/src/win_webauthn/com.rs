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
