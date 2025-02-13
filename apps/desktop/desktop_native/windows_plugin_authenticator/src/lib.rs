#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

mod pa;

use pa::{
    EXPERIMENTAL_WebAuthNPluginAddAuthenticator, DWORD,
    EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST,
    EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
    EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE, LPCWSTR, PBYTE, WCHAR,
    _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
};
use std::ffi::c_uchar;
use std::ptr;
use windows::Win32::System::Com::*;
use windows::Win32::Foundation::*;
use windows::Win32::System::LibraryLoader::*;
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

    // build the request
    let authenticator_name: HSTRING = "Bitwarden Desktop Authenticator".into();
    let authenticator_name_ptr = PCWSTR(authenticator_name.as_ptr()).as_ptr();

    let clsid: HSTRING = "0f7dc5d9-69ce-4652-8572-6877fd695062".into();
    let clsid_ptr = PCWSTR(clsid.as_ptr()).as_ptr();

    let aaguid: HSTRING = "d548826e-79b4-db40-a3d8-11116f7e8349".into();
    let aaguid_ptr = PCWSTR(aaguid.as_ptr()).as_ptr();

    let relying_party_id: HSTRING = "bitwarden.com".into();
    let relying_party_id_ptr = PCWSTR(relying_party_id.as_ptr()).as_ptr();

    let mut pbPluginIdKey: u8 = 0;

    /*
        pub struct _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
            pub pwszAuthenticatorName: LPCWSTR,
            pub pwszPluginClsId: LPCWSTR,
            pub pwszPluginRpId: LPCWSTR,
            pub pwszLightThemeLogo: LPCWSTR,
            pub pwszDarkThemeLogo: LPCWSTR,
            pub cbAuthenticatorInfo: DWORD,
            pub pbAuthenticatorInfo: PBYTE,
            pub cbPluginIdKey: DWORD,
            pub pbPluginIdKey: PBYTE,
        }
    */

    // The following hex strings represent the encoding of
    // {1: ["FIDO_2_0", "FIDO_2_1"], 2: ["prf", "hmac-secret"], 3: h'/* AAGUID */', 4: {"rk": true, "up": true, "uv": true}, 
    // 9: ["internal"], 10: [{"alg": -7, "type": "public-key"}]}

    // D548826E79B4DB40A3D811116F7E8349
    let cbor_thing = "A60182684649444F5F325F30684649444F5F325F310282637072666B686D61632D7365637265740350D548826E79B4DB40A3D811116F7E834904A362726BF5627570F5627576F5098168696E7465726E616C0A81A263616C672664747970656A7075626C69632D6B6579";
    let mut h = hex::decode(cbor_thing).unwrap();

    let mut add_options = _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
        pwszAuthenticatorName: authenticator_name_ptr,
        pwszPluginClsId: clsid_ptr,
        pwszPluginRpId: relying_party_id_ptr,
        pwszLightThemeLogo: ptr::null_mut(),
        pwszDarkThemeLogo: ptr::null_mut(),
        cbAuthenticatorInfo: h.len() as u32,
        pbAuthenticatorInfo: h.as_mut_ptr(),
        cbPluginIdKey: 0 as u32,
        pbPluginIdKey: ptr::null_mut(),
    };

    // build the response

    /*
        pub struct _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
            pub cbOpSignPubKey: DWORD,
            pub pbOpSignPubKey: PBYTE,
        }
    */

    let cbOpSignPubKey: DWORD = 0;
    let mut pbOpSignPubKey: c_uchar = 0;
    let pbOpSignPubKey_ptr: PBYTE = &mut pbOpSignPubKey;

    let mut add_response = EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
        cbOpSignPubKey: cbOpSignPubKey,
        pbOpSignPubKey: pbOpSignPubKey_ptr,
    };

    let mut add_response_ptr: *mut EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE = &mut add_response;

    // Add the authenticator
    //let r: i32 = unsafe { EXPERIMENTAL_WebAuthNPluginAddAuthenticator(&mut add_options, &mut add_response_ptr) };

    //println!("AddAuthenticator() -> {:?}/n{:?}", r, HRESULT(r).message());

    unsafe {
        if let Some(api) = delay_load::<EXPERIMENTAL_WebAuthNPluginAddAuthenticatorType>(s!("webauthn.dll"), s!("EXPERIMENTAL_WebAuthNPluginAddAuthenticator"))
        {
            let r: HRESULT = api(&mut add_options, &mut add_response_ptr);
            println!("AddAuthenticator() -> {:?}/n{:?}", r, r.message());
            let err = GetLastError();
            println!("Last error: {:?}", err);
        } else {
            println!("Can't find API");
        }
    }

    8
}

/*
unsafe extern "C" {
    pub fn EXPERIMENTAL_WebAuthNPluginAddAuthenticator(
        pPluginAddAuthenticatorOptions: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
        ppPluginAddAuthenticatorResponse : * mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
    ) -> HRESULT;
}
*/

type EXPERIMENTAL_WebAuthNPluginAddAuthenticatorType = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorOptions: pa::EXPERIMENTAL_PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    ppPluginAddAuthenticatorResponse : *mut pa::EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
) -> HRESULT;

pub unsafe fn delay_load<T>(library: PCSTR, function: PCSTR) -> Option<T> {
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

pub fn get_test_number() -> i32 {
    -1
}

pub fn get_version_number() -> u32 {
    unsafe { pa::WebAuthNGetApiVersionNumber() }
}

/*
    pub type WCHAR = u16;
    pub type LPCWSTR = *const WCHAR;

    pub type DWORD = ::std::os::raw::c_ulong;

    pub type BYTE = ::std::os::raw::c_uchar;
    pub type PBYTE = *mut BYTE;

    #[repr(C)]
    #[derive(Debug, Copy, Clone)]
    pub struct _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
        pub pwszAuthenticatorName: LPCWSTR,
        pub pwszPluginClsId: LPCWSTR,
        pub pwszAaguid: LPCWSTR,
        pub pwszPluginRpId: LPCWSTR,
        pub pwszLogo: LPCWSTR,
        pub cbPluginIdKey: DWORD,
        pub pbPluginIdKey: PBYTE,
    }

    pub type EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE =
    *mut _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE;

    #[repr(C)]
    #[derive(Debug, Copy, Clone)]
    pub struct _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
        pub cbUvPubKey: DWORD,
        pub pbUvPubKey: PBYTE,
    }

    unsafe extern "C" {
    pub fn EXPERIMENTAL_WebAuthNPluginAddAuthenticator(
        pPluginAddAuthenticatorOptions: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
        ppPluginAddAuthenticatorResponse : * mut EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
    ) -> HRESULT;
}
*/
pub fn add_authenticator(
    add_authenticator_options: _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    add_authenticator_response: EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
) -> i32 {
    0
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
