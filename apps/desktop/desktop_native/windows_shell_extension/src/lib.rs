#![cfg(target_os = "windows")]
#![allow(non_snake_case)]

use std::ffi::c_void;

use windows::Win32::Foundation::*;
use windows_core::*;

mod explorer_command;

/// CLSID for the Bitwarden shell extension COM object.
/// {A585A128-2049-4934-AE35-CEA51A83622B}
pub const CLSID_BITWARDEN_SHELL_EXTENSION: GUID = GUID {
    data1: 0xA585A128,
    data2: 0x2049,
    data3: 0x4934,
    data4: [0xAE, 0x35, 0xCE, 0xA5, 0x1A, 0x83, 0x62, 0x2B],
};

/// COM DLL entry point: returns a class factory for the requested CLSID.
///
/// # Safety
///
/// Called by the COM runtime with valid pointers. `ppv` must be a valid
/// out-parameter for a COM interface pointer.
#[no_mangle]
pub unsafe extern "system" fn DllGetClassObject(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut c_void,
) -> HRESULT {
    if ppv.is_null() {
        return E_POINTER;
    }
    *ppv = std::ptr::null_mut();

    if rclsid.is_null() || *rclsid != CLSID_BITWARDEN_SHELL_EXTENSION {
        return HRESULT(0x80040111_u32 as i32); // CLASS_E_CLASSNOTAVAILABLE
    }

    let factory: IInspectable = explorer_command::ClassFactory.into();
    factory.query(riid, ppv)
}

/// COM DLL entry point: the DLL should not be unloaded while explorer.exe is
/// running, so always return S_FALSE.
#[no_mangle]
pub extern "system" fn DllCanUnloadNow() -> HRESULT {
    S_FALSE
}
