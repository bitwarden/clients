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

    unsafe {

        type WebAuthNGetApiVersionNumberType = unsafe extern "cdecl" fn() -> u32;

        if let Some(api) = delay_load::<WebAuthNGetApiVersionNumberType>(s!("webauthn.dll"), s!("WebAuthNGetApiVersionNumber"))
        {
            let r: u32 = api();
            println!("GetVersion() -> {:?}", r);
            let err = GetLastError();
            println!("Last error: {:?}", err);
        } else {
            println!("Can't find API");
        }
    }

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

    let picture: HSTRING = "C:\\Users\\cdh-b\\Desktop\\shield.png".into();
    let picture_ptr = PCWSTR(picture.as_ptr()).as_ptr();

    // random 'ECDSA key NIST P-256' public key hex encoded
    // chosen b/c this type was in the example: https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/ns-bcrypt-bcrypt_ecckey_blob
    let key_data = "0495cadb75b265c780311f6b201e003b844738f3718de09e7968e66169f16b10d8fc85f44136cb77422be84115834c90793c4c51ddc43055f5d0469680f6f144a9";
    let mut key = hex::decode(key_data).unwrap();

    let js: HSTRING = "PCEtLSBSZXBsYWNlIHRoZSBjb250ZW50cyBvZiB0aGlzIGVkaXRvciB3aXRoIHlvdXIgU1ZHIGNvZGUgLS0+Cgo8c3ZnIHJvbGU9ImltZyIgdmlld0JveD0iMCAwIDI0IDI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxwYXRoIGQ9Ik0wIDBoMjR2MjRIMFYwem0yMi4wMzQgMTguMjc2Yy0uMTc1LTEuMDk1LS44ODgtMi4wMTUtMy4wMDMtMi44NzMtLjczNi0uMzQ1LTEuNTU0LS41ODUtMS43OTctMS4xNC0uMDkxLS4zMy0uMTA1LS41MS0uMDQ2LS43MDUuMTUtLjY0Ni45MTUtLjg0IDEuNTE1LS42Ni4zOS4xMi43NS40Mi45NzYuOSAxLjAzNC0uNjc2IDEuMDM0LS42NzYgMS43NTUtMS4xMjUtLjI3LS40Mi0uNDA0LS42MDEtLjU4Ni0uNzgtLjYzLS43MDUtMS40NjktMS4wNjUtMi44MzQtMS4wMzRsLS43MDUuMDg5Yy0uNjc2LjE2NS0xLjMyLjUyNS0xLjcxIDEuMDA1LTEuMTQgMS4yOTEtLjgxMSAzLjU0MS41NjkgNC40NzEgMS4zNjUgMS4wMiAzLjM2MSAxLjI0NCAzLjYxNiAyLjIwNS4yNCAxLjE3LS44NyAxLjU0NS0xLjk2NiAxLjQxLS44MTEtLjE4LTEuMjYtLjU4Ni0xLjc1NS0xLjMzNmwtMS44MyAxLjA1MWMuMjEuNDguNDUuNjg5LjgxIDEuMTA5IDEuNzQgMS43NTYgNi4wOSAxLjY2NiA2Ljg3MS0xLjAwNC4wMjktLjA5LjI0LS43MDUuMDc0LTEuNjVsLjA0Ni4wNjd6bS04Ljk4My03LjI0NWgtMi4yNDhjMCAxLjkzOC0uMDA5IDMuODY0LS4wMDkgNS44MDUgMCAxLjIzMi4wNjMgMi4zNjMtLjEzOCAyLjcxMS0uMzMuNjg5LTEuMTguNjAxLTEuNTY2LjQ4LS4zOTYtLjE5Ni0uNTk3LS40NjYtLjgzLS44NTUtLjA2My0uMTA1LS4xMS0uMTk2LS4xMjctLjE5NmwtMS44MjUgMS4xMjVjLjMwNS42My43NSAxLjE3MiAxLjMyNCAxLjUxNy44NTUuNTEgMi4wMDQuNjc1IDMuMjA3LjQwNS43ODMtLjIyNiAxLjQ1OC0uNjkxIDEuODExLTEuNDExLjUxLS45My40MDItMi4wNy4zOTctMy4zNDYuMDEyLTIuMDU0IDAtNC4xMDkgMC02LjE3OWwuMDA0LS4wNTZ6Ii8+Cjwvc3ZnPg==".into();
    let mut js_ptr = PCWSTR(js.as_ptr()).as_ptr();

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
        pwszLightThemeLogo: js_ptr,
        pwszDarkThemeLogo: js_ptr,
        cbAuthenticatorInfo: h.len() as u32,
        pbAuthenticatorInfo: h.as_mut_ptr(),
        cbPluginIdKey: key.len() as u32,
        pbPluginIdKey: key.as_mut_ptr(),
    };

    let mut v2 = _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS_V2 {
        pwszAuthenticatorName: authenticator_name_ptr,
        pwszPluginClsId: clsid_ptr,
        pwszPluginRpId: relying_party_id_ptr,
        pwszAaguid: ptr::null(),
        pwszLogo: js_ptr,
        cbPluginIdKey: key.len() as u32,
        pbPluginIdKey: key.as_mut_ptr(),
    };

    let mut v0 = _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS_V0 {
        pwszAuthenticatorName: authenticator_name_ptr,
        pwszPluginClsId: clsid_ptr,
        pwszPluginRpId: relying_party_id_ptr,
        pwszLightThemeLogo: js_ptr,
        pwszDarkThemeLogo: js_ptr,
        cbAuthenticatorInfo: h.len() as u32,
        pbAuthenticatorInfo: h.as_mut_ptr(),
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
        if let Some(api) = delay_load::<EXPERIMENTAL_WebAuthNPluginAddAuthenticatorTypeV0>(s!("webauthn.dll"), s!("EXPERIMENTAL_WebAuthNPluginAddAuthenticator"))
        {
            let r: HRESULT = api(&v0, &mut add_response_ptr);
            println!("AddAuthenticator() -> {:?}/n{:?}", r, r.message());
            let err = GetLastError();
            println!("Last error: {:?}", err);
        } else {
            println!("Can't find API");
        }
    }

    // unsafe {
    //     if let Some(api) = delay_load::<EXPERIMENTAL_WebAuthNPluginAddAuthenticatorType>(s!("webauthn.dll"), s!("EXPERIMENTAL_WebAuthNPluginAddAuthenticator"))
    //     {
    //         let r: HRESULT = api(&add_options, &mut add_response_ptr);
    //         println!("AddAuthenticator() -> {:?}/n{:?}", r, r.message());
    //         let err = GetLastError();
    //         println!("Last error: {:?}", err);
    //     } else {
    //         println!("Can't find API");
    //     }
    // }

    // unsafe {
    //     if let Some(api) = delay_load::<EXPERIMENTAL_WebAuthNPluginAddAuthenticatorTypeV2>(s!("webauthn.dll"), s!("EXPERIMENTAL_WebAuthNPluginAddAuthenticator"))
    //     {
    //         let r: HRESULT = api(&v2, &mut add_response_ptr);
    //         println!("AddAuthenticator() -> {:?}/n{:?}", r, r.message());
    //         let err = GetLastError();
    //         println!("Last error: {:?}", err);
    //     } else {
    //         println!("Can't find API");
    //     }
    // }

    // seg fault, which makes sense
    // unsafe {
    //     if let Some(api) = delay_load::<EXPERIMENTAL_WebAuthNPluginAddAuthenticatorTypeV3>(s!("webauthn.dll"), s!("EXPERIMENTAL_WebAuthNPluginAddAuthenticator"))
    //     {
    //         let r: HRESULT = api();
    //         println!("AddAuthenticator() -> {:?}/n{:?}", r, r.message());
    //         let err = GetLastError();
    //         println!("Last error: {:?}", err);
    //     } else {
    //         println!("Can't find API");
    //     }
    // }

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

/*
typedef struct _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
    // Authenticator Name
    LPCWSTR pwszAuthenticatorName;

    // Plugin COM ClsId
    LPCWSTR pwszPluginClsId;

    // Plugin RPID (Optional. Required for a nested WebAuthN call originating from a plugin)
    LPCWSTR pwszPluginRpId;

    // Plugin Authenticator Logo for the Light themes. base64 svg (Optional)
    LPCWSTR pwszLightThemeLogo;

    // Plugin Authenticator Logo for the Dark themes. base64 svg (Optional)
    LPCWSTR pwszDarkThemeLogo;

    // CTAP CBOR encoded authenticatorGetInfo
    DWORD cbAuthenticatorInfo;
    _Field_size_bytes_(cbAuthenticatorInfo)
    PBYTE pbAuthenticatorInfo;

} EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS, *EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS;
typedef const EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS *EXPERIMENTAL_PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS;
*/

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS_V0 {
    pub pwszAuthenticatorName: *const u16,
    pub pwszPluginClsId: *const u16,
    pub pwszPluginRpId: *const u16,
    pub pwszLightThemeLogo: *const u16,
    pub pwszDarkThemeLogo: *const u16,
    pub cbAuthenticatorInfo: u32,
    pub pbAuthenticatorInfo: *const u8,
}

// ADD OPTIONS V2
#[repr(C)]
struct _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS_V2 {
    // Authenticator Name
    pwszAuthenticatorName: *const u16,
    // Plugin COM ClsId
    pwszPluginClsId: *const u16,
    // Plugin Authenticator AAGUID (Optional)
    pwszAaguid: *const u16,
    // Plugin RPID (Optional)
    pwszPluginRpId: *const u16,
    // Plugin Authenticator Logo base64 svg (Optional)
    pwszLogo: *const u16,
    // Plugin Id Public Key
    cbPluginIdKey: u32,
    pbPluginIdKey: *const u8,
}

type EXPERIMENTAL_WebAuthNPluginAddAuthenticatorTypeV0 = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorOptions: *const _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS_V0,
    ppPluginAddAuthenticatorResponse : *mut pa::EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
) -> HRESULT;

type EXPERIMENTAL_WebAuthNPluginAddAuthenticatorType = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorOptions: pa::EXPERIMENTAL_PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    ppPluginAddAuthenticatorResponse : *mut pa::EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
) -> HRESULT;

type EXPERIMENTAL_WebAuthNPluginAddAuthenticatorTypeV2 = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorOptions: *const _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS_V2,
    ppPluginAddAuthenticatorResponse : *mut pa::EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
) -> HRESULT;

type EXPERIMENTAL_WebAuthNPluginAddAuthenticatorTypeV3 = unsafe extern "cdecl" fn() -> HRESULT;

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
