#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::ffi::c_uchar;
use std::ptr;
use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;
use windows::Win32::System::LibraryLoader::*;
use windows_core::*;

mod pluginauthenticator;
mod webauthn;

const AUTHENTICATOR_NAME: &str = "Bitwarden Desktop Authenticator";
//const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";
const RPID: &str = "bitwarden.com";

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
    static FACTORY: windows_core::StaticComObject<pluginauthenticator::Factory> =
        pluginauthenticator::Factory().into_static();
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

    let add_authenticator_options = webauthn::ExperimentalWebAuthnPluginAddAuthenticatorOptions {
        authenticator_name: authenticator_name_ptr,
        com_clsid: clsid_ptr,
        rpid: relying_party_id_ptr,
        light_theme_logo: ptr::null(), // unused by Windows
        dark_theme_logo: ptr::null(),  // unused by Windows
        cbor_authenticator_info_byte_count: authenticator_info_bytes.len() as u32,
        cbor_authenticator_info: authenticator_info_bytes.as_mut_ptr(),
    };

    let plugin_signing_public_key_byte_count: u32 = 0;
    let mut plugin_signing_public_key: c_uchar = 0;
    let plugin_signing_public_key_ptr = &mut plugin_signing_public_key;

    let mut add_response = webauthn::ExperimentalWebAuthnPluginAddAuthenticatorResponse {
        plugin_operation_signing_key_byte_count: plugin_signing_public_key_byte_count,
        plugin_operation_signing_key: plugin_signing_public_key_ptr,
    };
    let mut add_response_ptr: *mut webauthn::ExperimentalWebAuthnPluginAddAuthenticatorResponse =
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

type EXPERIMENTAL_WebAuthNPluginAddAuthenticatorFnDeclaration = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorOptions: *const webauthn::ExperimentalWebAuthnPluginAddAuthenticatorOptions,
    ppPluginAddAuthenticatorResponse: *mut *mut webauthn::ExperimentalWebAuthnPluginAddAuthenticatorResponse,
) -> HRESULT;

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
