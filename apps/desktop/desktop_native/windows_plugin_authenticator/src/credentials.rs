use crate::pa::{DWORD, PBYTE};

use std::ffi::c_uchar;
use std::ptr;

use windows::Win32::Foundation::*;
use windows::Win32::System::LibraryLoader::*;
use windows_core::*;

const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

/// Adds credentials for native Windows browser autofill.
pub fn add_credentials() -> std::result::Result<(), String> {
    let mut pb_credential_id: c_uchar = 0;
    let pb_credential_id_ptr: PBYTE = &mut pb_credential_id;

    let pwsz_rp_id = "bitwarden.com";
    let mut pwsz_rp_id_vec: Vec<u16> = pwsz_rp_id.encode_utf16().collect();
    pwsz_rp_id_vec.push(0);
    let mut pwsz_rp_id_ptr = pwsz_rp_id_vec.as_mut_ptr();

    let pwsz_rp_name = "Bitwarden";
    let mut pwsz_rp_name_vec: Vec<u16> = pwsz_rp_name.encode_utf16().collect();
    pwsz_rp_name_vec.push(0);
    let mut pwsz_rp_name_ptr = pwsz_rp_name_vec.as_mut_ptr();

    let mut pb_user_id: c_uchar = 0;
    let pb_user_id_ptr: PBYTE = &mut pb_user_id;

    let pwsz_user_name = "Bitwarden";
    let mut pwsz_user_name_vec: Vec<u16> = pwsz_user_name.encode_utf16().collect();
    pwsz_user_name_vec.push(0);
    let mut pwsz_user_name_ptr = pwsz_user_name_vec.as_mut_ptr();

    let pwsz_user_display_name = "Bitwarden (Display Name)";
    let mut pwsz_user_display_name_vec: Vec<u16> = pwsz_user_display_name.encode_utf16().collect();
    pwsz_user_display_name_vec.push(0);
    let mut pwsz_user_display_name_ptr = pwsz_user_display_name_vec.as_mut_ptr();

    let mut credential_details_1 = EXPERIMENTAL_WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS {
        cbCredentialId: 0,
        pbCredentialId: pb_credential_id_ptr,
        pwszRpId: PWSTR(pwsz_rp_id_ptr),
        pwszRpName: PWSTR(pwsz_rp_name_ptr),
        cbUserId: 0,
        pbUserId: pb_user_id_ptr,
        pwszUserName: PWSTR(pwsz_user_name_ptr),
        pwszUserDisplayName: PWSTR(pwsz_user_display_name_ptr),
    };
    let mut credential_details_ptr: *mut EXPERIMENTAL_WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS =
        &mut credential_details_1;

    let clsid = format!("{{{}}}", CLSID);
    let mut clsid_vec: Vec<u16> = clsid.encode_utf16().collect();
    clsid_vec.push(0);
    let mut clsid_ptr = clsid_vec.as_mut_ptr();

    let pb_nonce: *mut u8 = std::ptr::null_mut();

    let pb_signature: *mut u8 = std::ptr::null_mut();

    let credential_details_list = EXPERIMENTAL_PWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS_LIST {
        pwszPluginClsId: PWSTR(clsid_ptr),
        cCredentialDetails: 1,
        pCredentialDetails: credential_details_ptr,
        cbNonce: 0,
        pbNonce: pb_nonce,
        cbSignature: 0,
        pbSignature: pb_signature,
    };

    match unsafe {
        if let Some(api) =
            delay_load::<EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration>(
                s!("webauthn.dll"),
                s!("EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials"),
            )
        {
            Ok(api(&credential_details_list))
        } else {
            Err(String::from("Error: Can't complete add_credentials(), as the function EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials can't be found."))
        }
    } {
        Ok(_) => Ok(()),
        Err(e) => Err(e),
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS {
    pub cbCredentialId: DWORD,
    pub pbCredentialId: PBYTE,
    pub pwszRpId: PWSTR,
    pub pwszRpName: PWSTR,
    pub cbUserId: DWORD,
    pub pbUserId: PBYTE,
    pub pwszUserName: PWSTR,
    pub pwszUserDisplayName: PWSTR,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct EXPERIMENTAL_PWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS_LIST {
    pub pwszPluginClsId: PWSTR,
    pub cCredentialDetails: DWORD,
    pub pCredentialDetails: *mut EXPERIMENTAL_WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS,
    pub cbNonce: DWORD,
    pub pbNonce: PBYTE,
    pub cbSignature: DWORD,
    pub pbSignature: PBYTE,
}

type EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        pCredentialDetailsList: *const EXPERIMENTAL_PWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS_LIST,
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
