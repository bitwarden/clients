#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::ffi::c_uchar;
use std::ptr;
use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;
use windows::Win32::System::LibraryLoader::*;
use windows_core::*;

const AUTHENTICATOR_NAME: &str = "Bitwarden Desktop Authenticator";
//const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";
const RPID: &str = "bitwarden.com";

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST {
    pub transactionId: GUID,
    pub cbRequestSignature: Dword,
    pub pbRequestSignature: *mut byte,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_REQUEST {
    pub hWnd: HWND,
    pub transactionId: GUID,
    pub cbRequestSignature: Dword,
    pub pbRequestSignature: *mut byte,
    pub cbEncodedRequest: Dword,
    pub pbEncodedRequest: *mut byte,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
    pub cbOpSignPubKey: Dword,
    pub pbOpSignPubKey: PByte,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_RESPONSE {
    pub cbEncodedResponse: Dword,
    pub pbEncodedResponse: *mut byte,
}

type Dword = u32;
type Byte = u8;
type byte = u8;
pub type PByte = *mut Byte;

type EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST =
    *const EXPERIMENTAL_WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST;
pub type EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST =
    *const EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_REQUEST;
pub type EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE =
    *mut EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_RESPONSE;
pub type EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE =
    *mut EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE;

/// Handles initialization and registration for the Bitwarden desktop app as a
/// plugin authenticator with Windows.
/// For now, also adds the authenticator
pub fn register() -> std::result::Result<(), String> {
    initialize_com_library()?;

    register_com_library()?;

    add_authenticator()?;

    Ok(())
}

/// Initializes the COM library for use on the calling thread,
/// and registers + sets the security values.
fn initialize_com_library() -> std::result::Result<(), String> {
    let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };

    if result.is_err() {
        return Err(format!(
            "Error: couldn't initialize the COM library\n{}",
            result.message()
        ));
    }

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
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "Error: couldn't initialize COM security\n{}",
            e.message()
        )),
    }
}

/// Registers the Bitwarden Plugin Authenticator COM library with Windows.
fn register_com_library() -> std::result::Result<(), String> {
    static FACTORY: windows_core::StaticComObject<Factory> = Factory().into_static();
    let clsid: *const GUID = &GUID::from_u128(0xa98925d161f640de9327dc418fcb2ff4);

    match unsafe {
        CoRegisterClassObject(
            clsid,
            FACTORY.as_interface_ref(),
            CLSCTX_LOCAL_SERVER,
            REGCLS_MULTIPLEUSE,
        )
    } {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "Error: couldn't register the COM library\n{}",
            e.message()
        )),
    }
}

/// Adds Bitwarden as a plugin authenticator.
fn add_authenticator() -> std::result::Result<(), String> {
    let authenticator_name: HSTRING = AUTHENTICATOR_NAME.into();
    let authenticator_name_ptr = PCWSTR(authenticator_name.as_ptr()).as_ptr();

    let clsid: HSTRING = format!("{{{}}}", CLSID).into();
    let clsid_ptr = PCWSTR(clsid.as_ptr()).as_ptr();

    let relying_party_id: HSTRING = RPID.into();
    let relying_party_id_ptr = PCWSTR(relying_party_id.as_ptr()).as_ptr();

    // let aaguid: HSTRING = format!("{{{}}}", AAGUID).into();
    // let aaguid_ptr = PCWSTR(aaguid.as_ptr()).as_ptr();

    // Example authenticator info blob
    let cbor_authenticator_info = "A60182684649444F5F325F30684649444F5F325F310282637072666B686D61632D7365637265740350D548826E79B4DB40A3D811116F7E834904A362726BF5627570F5627576F5098168696E7465726E616C0A81A263616C672664747970656A7075626C69632D6B6579";
    let mut authenticator_info_bytes = hex::decode(cbor_authenticator_info).unwrap();

    let add_authenticator_options = EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
        pwszAuthenticatorName: authenticator_name_ptr,
        pwszPluginClsId: clsid_ptr,
        pwszPluginRpId: relying_party_id_ptr,
        pwszLightThemeLogo: ptr::null(), // unused by Windows
        pwszDarkThemeLogo: ptr::null(),  // unused by Windows
        cbAuthenticatorInfo: authenticator_info_bytes.len() as u32,
        pbAuthenticatorInfo: authenticator_info_bytes.as_mut_ptr(),
    };

    let plugin_signing_public_key_byte_count: Dword = 0;
    let mut plugin_signing_public_key: c_uchar = 0;
    let plugin_signing_public_key_ptr: PByte = &mut plugin_signing_public_key;

    let mut add_response = EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
        cbOpSignPubKey: plugin_signing_public_key_byte_count,
        pbOpSignPubKey: plugin_signing_public_key_ptr,
    };
    let mut add_response_ptr: *mut EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE =
        &mut add_response;

    let result = unsafe {
        delay_load::<EXPERIMENTAL_WebAuthNPluginAddAuthenticatorFnDeclaration>(
            s!("webauthn.dll"),
            s!("EXPERIMENTAL_WebAuthNPluginAddAuthenticator"),
        )
    };

    match result {
        Some(api) => {
            let result = unsafe { api(&add_authenticator_options, &mut add_response_ptr) };

            if result.is_err() {
                return Err(format!(
                    "Error: Error response from EXPERIMENTAL_WebAuthNPluginAddAuthenticator()\n{}",
                    result.message()
                ));
            }

            Ok(())
        },
        None => {
            Err(String::from("Error: Can't complete add_authenticator(), as the function EXPERIMENTAL_WebAuthNPluginAddAuthenticator can't be found."))
        }
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
    pub pwszAuthenticatorName: *const u16,
    pub pwszPluginClsId: *const u16,
    pub pwszPluginRpId: *const u16,
    pub pwszLightThemeLogo: *const u16,
    pub pwszDarkThemeLogo: *const u16,
    pub cbAuthenticatorInfo: u32,
    pub pbAuthenticatorInfo: *const u8,
}

type EXPERIMENTAL_WebAuthNPluginAddAuthenticatorFnDeclaration = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorOptions: *const EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    ppPluginAddAuthenticatorResponse: *mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
)
    -> HRESULT;

unsafe fn delay_load<T>(library: PCSTR, function: PCSTR) -> Option<T> {
    let library = LoadLibraryExA(library, None, LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);

    let Ok(library) = library else {
        return None;
    };

    let address = GetProcAddress(library, function);

    if address.is_some() {
        return Some(std::mem::transmute_copy(&address));
    }

    _ = FreeLibrary(library);

    None
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
        _request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
        _response: *mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_PluginGetAssertion(
        &self,
        _request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
        _response: *mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_PluginCancelOperation(
        &self,
        _request: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    ) -> HRESULT {
        HRESULT(0)
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
