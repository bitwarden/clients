//! Functions for interacting with Windows COM.

use std::ptr;

use windows::{
    core::{implement, ComObjectInterface, IUnknown, GUID},
    Win32::System::Com::*,
};

use super::{ErrorKind, WinWebAuthnError};

#[implement(IClassFactory)]
pub struct Factory;

impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        _outer: windows::core::Ref<IUnknown>,
        _iid: *const windows::core::GUID,
        _object: *mut *mut core::ffi::c_void,
    ) -> windows::core::Result<()> {
        unimplemented!()
    }

    fn LockServer(&self, _lock: windows::core::BOOL) -> windows::core::Result<()> {
        unimplemented!()
    }
}

/// Registers the plugin authenticator COM library with Windows.
pub(super) fn register_server(clsid: &GUID) -> Result<(), WinWebAuthnError> {
    static FACTORY: windows::core::StaticComObject<crate::com_provider::Factory> =
        crate::com_provider::Factory.into_static();
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
