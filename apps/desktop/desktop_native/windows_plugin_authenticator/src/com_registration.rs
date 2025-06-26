use std::ffi::OsString;
use std::os::windows::ffi::OsStrExt;
use std::ffi::c_uchar;
use std::ptr;

use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;
use windows_core::{s, HRESULT, PCWSTR, ComObjectInterface, GUID, HSTRING};

use crate::utils::{WindowsString, delay_load, message};
use crate::webauthn::*;
use crate::com_provider;
use hex;

const AUTHENTICATOR_NAME: &str = "Bitwarden Desktop Authenticator";
const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";
const RPID: &str = "bitwarden.com";

/// Initializes the COM library for use on the calling thread,
/// and registers + sets the security values.
pub fn initialize_com_library() -> std::result::Result<(), String> {
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
pub fn register_com_library() -> std::result::Result<(), String> {
    static FACTORY: windows_core::StaticComObject<com_provider::Factory> =
        com_provider::Factory.into_static();
    //let clsid: *const GUID = &GUID::from_u128(0xa98925d161f640de9327dc418fcb2ff4);
    let clsid: *const GUID = &GUID::from_u128(0x0f7dc5d969ce465285726877fd695062);

    match unsafe {
        CoRegisterClassObject(
            clsid,
            FACTORY.as_interface_ref(),
            //FACTORY.as_interface::<pluginauthenticator::EXPERIMENTAL_IPluginAuthenticator>(),
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

// testing wide encoding
pub fn add_authenticator_using_wide_encoding() -> std::result::Result<(), String> {
    // let (authenticator_name_pointer, authenticator_name_bytes) = String::from(AUTHENTICATOR_NAME).into_win_utf16_wide();
    let mut authenticator_name: Vec<u16> = OsString::from(AUTHENTICATOR_NAME).encode_wide().collect();
    //authenticator_name.push(0);
    let authenticator_name_pointer = authenticator_name.as_mut_ptr();

    // let (clsid_pointer, clsid_bytes) = String::from(CLSID).into_win_utf16_wide();
    let mut clsid: Vec<u16> = OsString::from(CLSID).encode_wide().collect();
    //clsid.push(0);
    let clsid_pointer = clsid.as_mut_ptr();

    // let (rpid_pointer, rpid_bytes) = String::from(RPID).into_win_utf16_wide();
    let mut rpid: Vec<u16> = OsString::from(RPID).encode_wide().collect();
    //rpid.push(0);
    let rpid_pointer = rpid.as_mut_ptr();

    // Example authenticator info blob
    let cbor_authenticator_info = "A60182684649444F5F325F30684649444F5F325F310282637072666B686D61632D7365637265740350D548826E79B4DB40A3D811116F7E834904A362726BF5627570F5627576F5098168696E7465726E616C0A81A263616C672664747970656A7075626C69632D6B6579";
    let mut authenticator_info_bytes = hex::decode(cbor_authenticator_info).unwrap();

    let add_authenticator_options = ExperimentalWebAuthnPluginAddAuthenticatorOptions {
        authenticator_name: authenticator_name_pointer,
        plugin_clsid: clsid_pointer,
        rpid: rpid_pointer,
        light_theme_logo: ptr::null(),
        dark_theme_logo: ptr::null(),
        cbor_authenticator_info_byte_count: authenticator_info_bytes.len() as u32,
        cbor_authenticator_info: authenticator_info_bytes.as_mut_ptr(),
    };

    let plugin_signing_public_key_byte_count: u32 = 0;
    let mut plugin_signing_public_key: c_uchar = 0;
    let plugin_signing_public_key_ptr = &mut plugin_signing_public_key;

    let mut add_response = ExperimentalWebAuthnPluginAddAuthenticatorResponse {
        plugin_operation_signing_key_byte_count: plugin_signing_public_key_byte_count,
        plugin_operation_signing_key: plugin_signing_public_key_ptr,
    };
    let mut add_response_ptr: *mut ExperimentalWebAuthnPluginAddAuthenticatorResponse =
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

/// Adds Bitwarden as a plugin authenticator.
pub fn add_authenticator() -> std::result::Result<(), String> {
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

    let add_authenticator_options = ExperimentalWebAuthnPluginAddAuthenticatorOptions {
        authenticator_name: authenticator_name_ptr,
        plugin_clsid: clsid_ptr,
        rpid: relying_party_id_ptr,
        light_theme_logo: ptr::null(),
        dark_theme_logo: ptr::null(),
        cbor_authenticator_info_byte_count: authenticator_info_bytes.len() as u32,
        cbor_authenticator_info: authenticator_info_bytes.as_mut_ptr(),
    };

    let plugin_signing_public_key_byte_count: u32 = 0;
    let mut plugin_signing_public_key: c_uchar = 0;
    let plugin_signing_public_key_ptr = &mut plugin_signing_public_key;

    let mut add_response = ExperimentalWebAuthnPluginAddAuthenticatorResponse {
        plugin_operation_signing_key_byte_count: plugin_signing_public_key_byte_count,
        plugin_operation_signing_key: plugin_signing_public_key_ptr,
    };
    let mut add_response_ptr: *mut ExperimentalWebAuthnPluginAddAuthenticatorResponse =
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
    pPluginAddAuthenticatorOptions: *const ExperimentalWebAuthnPluginAddAuthenticatorOptions,
    ppPluginAddAuthenticatorResponse: *mut *mut ExperimentalWebAuthnPluginAddAuthenticatorResponse,
) -> HRESULT;