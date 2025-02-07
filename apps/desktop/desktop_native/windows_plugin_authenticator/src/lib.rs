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
use windows_core::*;
//use windows_sys::{core::GUID, Win32::System::Com::{CoInitialize, CoInitializeSecurity, CoRegisterClassObject, IClassFactory, EOAC_NONE, RPC_C_AUTHN_LEVEL_DEFAULT, RPC_C_IMP_LEVEL_IMPERSONATE}};
use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;

pub fn register() -> i32 {
    let com_object: PACOMObject;

    // let result: HRESULT = unsafe {
    //     HRESULT(CoInitialize(com_object_ptr))
    // };

    // https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/PasskeyManager/cpp/App.xaml.cpp
    // https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coinitializesecurity
    unsafe {
        CoInitializeSecurity(None, -1, None, None, RPC_C_AUTHN_LEVEL_DEFAULT, RPC_C_IMP_LEVEL_IMPERSONATE, None, EOAC_NONE, None)
    }.unwrap();

    // https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/PasskeyManager/cpp/App.xaml.cpp
    // https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coregisterclassobject
    // Random GUID: a98925d1-61f6-40de-9327-dc418fcb2ff4
    // let random_plugin_guid_ptr: *const GUID = &GUID {
    //     data1: 0xa98925d1 as u32,
    //     data2: 0x61f6 as u16,
    //     data3: 0x40de as u16,
    //     data4: [0x93, 0x27, 0xdc, 0x41, 0x8f, 0xcb, 0x2f, 0xf4],
    // };
    // let random_plugin_guid_ptr: *const GUID = &GUID::from_u128(0xa98925d161f640de9327dc418fcb2ff4);
    // let register_object_result: HRESULT = unsafe {
    //     CoRegisterClassObject(random_plugin_guid_ptr, ))
    // };

    let random_plugin_guid_ptr: *const GUID = &GUID::from_u128(0xa98925d161f640de9327dc418fcb2ff4);
    let mut f = Factory();
    let mut f_ptr = &mut f as *mut _ as *mut core::ffi::c_void;
    let result: u32 = unsafe {
        CoRegisterClassObject(random_plugin_guid_ptr, &IUnknown::from_raw(f_ptr), CLSCTX_LOCAL_SERVER, REGCLS_MULTIPLEUSE)
    }.unwrap();

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
