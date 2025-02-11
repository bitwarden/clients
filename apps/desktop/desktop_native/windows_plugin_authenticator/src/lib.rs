#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

mod pa;

use pa::{
    EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
    EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
};
use std::ptr;
use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;
use windows_core::*;

pub fn register() -> i32 {
    println!("register()");

    let r = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    println!("CoInitialize(): {:?}", r);

    match unsafe {
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
    } {
        Ok(()) => println!("CoInitializeSecurity(): ()"),
        Err(e) => println!("Error calling CoInitializeSecurity(): {:?}", e),
    }

    static FACTORY: windows_core::StaticComObject<Factory> = Factory().into_static();

    let random_plugin_guid_ptr: *const GUID = &GUID::from_u128(0xa98925d161f640de9327dc418fcb2ff4);
    let result: u32 = match unsafe {
        CoRegisterClassObject(
            random_plugin_guid_ptr,
            FACTORY.as_interface_ref(),
            CLSCTX_LOCAL_SERVER,
            REGCLS_MULTIPLEUSE,
        )
    } {
        Ok(r) => {
            println!("CoRegisterClassObject(): {:?}", r);
            r
        }
        Err(e) => {
            println!("Error calling CoRegisterClassObject(): {:?}", e);
            0
        }
    };

    8
}

pub fn get_test_number() -> i32 {
    -1
}

pub fn get_version_number() -> u64 {
    unsafe { pa::WebAuthNGetApiVersionNumber() }.into()
}

#[interface("e6466e9a-b2f3-47c5-b88d-89bc14a8d998")]
unsafe trait EXPERIMENTAL_IPluginAuthenticator: IUnknown {
    fn EXPERIMENTAL_PluginMakeCredential(
        &self,
        request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT;
    fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT;
    fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    ) -> HRESULT;
}

#[implement(EXPERIMENTAL_IPluginAuthenticator)]
struct PACOMObject;

impl EXPERIMENTAL_IPluginAuthenticator_Impl for PACOMObject_Impl {
    unsafe fn EXPERIMENTAL_PluginMakeCredential(
        &self,
        request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        HRESULT(get_test_number())
    }

    unsafe fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        HRESULT(get_test_number())
    }

    unsafe fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    ) -> HRESULT {
        HRESULT(get_test_number())
    }
}

#[implement(IClassFactory)]
struct Factory();

impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        outer: Ref<IUnknown>,
        iid: *const GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> Result<()> {
        assert!(outer.is_null());
        let unknown: IInspectable = PACOMObject.into();
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, lock: BOOL) -> Result<()> {
        assert!(lock.as_bool());
        Ok(())
    }
}
