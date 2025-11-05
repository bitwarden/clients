/*
    This file exposes safe functions and types for interacting with the experimental
    Windows WebAuthn API defined here:

    https://github.com/microsoft/webauthn/blob/master/experimental/webauthn.h
*/

use windows_core::*;

use crate::util::{debug_log, delay_load, WindowsString};
use crate::com_buffer::ComBuffer;

/// Windows WebAuthn Authenticator Options structure
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnCtapCborAuthenticatorOptions {
    pub version: u32,                 // DWORD dwVersion
    pub user_presence: i32,           // LONG lUp: +1=TRUE, 0=Not defined, -1=FALSE
    pub user_verification: i32,       // LONG lUv: +1=TRUE, 0=Not defined, -1=FALSE
    pub require_resident_key: i32,    // LONG lRequireResidentKey: +1=TRUE, 0=Not defined, -1=FALSE
}

/// Used when adding a Windows plugin authenticator.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS
/// Header File Usage: EXPERIMENTAL_WebAuthNPluginAddAuthenticator()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginAddAuthenticatorOptions {
    pub authenticator_name: *const u16,
    pub plugin_clsid: *const u16,
    pub rpid: *const u16,
    pub light_theme_logo: *const u16,
    pub dark_theme_logo: *const u16,
    pub cbor_authenticator_info_byte_count: u32,
    pub cbor_authenticator_info: *const u8,
}

/// Used as a response type when adding a Windows plugin authenticator.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
/// Header File Usage: EXPERIMENTAL_WebAuthNPluginAddAuthenticator()
///                    EXPERIMENTAL_WebAuthNPluginFreeAddAuthenticatorResponse()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginAddAuthenticatorResponse {
    pub plugin_operation_signing_key_byte_count: u32,
    pub plugin_operation_signing_key: *mut u8,
}

/// Represents a credential.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS
/// Header File Usage: _EXPERIMENTAL_WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS_LIST
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginCredentialDetails {
    pub credential_id_byte_count: u32,
    pub credential_id_pointer: *mut u8,
    pub rpid: *mut u16,
    pub rp_friendly_name: *mut u16,
    pub user_id_byte_count: u32,
    pub user_id_pointer: *mut u8,  // Should be *mut u8 like credential_id_pointer
    pub user_name: *mut u16,
    pub user_display_name: *mut u16,
}

impl ExperimentalWebAuthnPluginCredentialDetails {
    pub fn create_from_bytes(
        credential_id: Vec<u8>,
        rpid: String,
        rp_friendly_name: String,
        user_id: Vec<u8>,
        user_name: String,
        user_display_name: String,
    ) -> Self {
        // Convert credential_id bytes to hex string, then allocate with COM
        let (credential_id_pointer, credential_id_byte_count) = ComBuffer::from_buffer(credential_id);

        // Convert user_id bytes to hex string, then allocate with COM
        let user_id_string = hex::encode(&user_id);
        let (user_id_pointer, user_id_byte_count) = ComBuffer::from_buffer(user_id_string.as_bytes());

        // Convert strings to null-terminated wide strings using trait methods
        let (rpid_ptr, _) = rpid.to_com_utf16();
        let (rp_friendly_name_ptr, _) = rp_friendly_name.to_com_utf16();
        let (user_name_ptr, _) = user_name.to_com_utf16();
        let (user_display_name_ptr, _) = user_display_name.to_com_utf16();

        Self {
            credential_id_byte_count,
            credential_id_pointer,
            rpid: rpid_ptr,
            rp_friendly_name: rp_friendly_name_ptr,
            user_id_byte_count,
            user_id_pointer,
            user_name: user_name_ptr,
            user_display_name: user_display_name_ptr,
        }
    }
}

/// Represents a list of credentials.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS_LIST
/// Header File Usage: EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials()
///                    EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveCredentials()
///                    EXPERIMENTAL_WebAuthNPluginAuthenticatorGetAllCredentials()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginCredentialDetailsList {
    pub plugin_clsid: *mut u16,
    pub credential_count: u32,
    pub credentials: *mut *mut ExperimentalWebAuthnPluginCredentialDetails,
}

impl ExperimentalWebAuthnPluginCredentialDetailsList {
    pub fn create(
        clsid: String,
        credentials: Vec<ExperimentalWebAuthnPluginCredentialDetails>,
    ) -> Self {
        // Convert credentials to COM-allocated pointers
        let credential_pointers: Vec<*mut ExperimentalWebAuthnPluginCredentialDetails> = credentials
            .into_iter()
            .map(|cred| {
                // Use COM allocation for each credential struct
                ComBuffer::with_object(cred)
            })
            .collect();

        let credentials_len = credential_pointers.len();
        
        // Allocate the array of pointers using COM as well
        let credentials_pointer = if credentials_len > 0 {
            let pointer_array_bytes = credential_pointers.len() * std::mem::size_of::<*mut ExperimentalWebAuthnPluginCredentialDetails>();
            let (ptr, _) = ComBuffer::from_buffer(unsafe {
                std::slice::from_raw_parts(
                    credential_pointers.as_ptr() as *const u8,
                    pointer_array_bytes
                )
            });
            ptr as *mut *mut ExperimentalWebAuthnPluginCredentialDetails
        } else {
            std::ptr::null_mut()
        };

        // Convert CLSID to wide string using trait method
        let (clsid_ptr, _) = clsid.to_com_utf16();
        
        Self {
            plugin_clsid: clsid_ptr,
            credential_count: credentials_len as u32,
            credentials: credentials_pointer,
        }
    }
}

pub type EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        pCredentialDetailsList: *mut ExperimentalWebAuthnPluginCredentialDetailsList,
    ) -> HRESULT;

pub type EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        pCredentialDetailsList: *mut ExperimentalWebAuthnPluginCredentialDetailsList,
    ) -> HRESULT;

pub type EXPERIMENTAL_WebAuthNPluginAuthenticatorGetAllCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        pwszPluginClsId: *const u16,
        ppCredentialDetailsList: *mut *mut ExperimentalWebAuthnPluginCredentialDetailsList,
    ) -> HRESULT;

pub type EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveAllCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        pwszPluginClsId: *const u16,
    ) -> HRESULT;

pub fn add_credentials(
    mut credentials_list: ExperimentalWebAuthnPluginCredentialDetailsList,
) -> std::result::Result<(), String> {
    debug_log("Loading EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials function...");
    
    let result = unsafe {
        delay_load::<EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials"),
        )
    };

    match result {
        Some(api) => {
            debug_log("Function loaded successfully, calling API...");
            debug_log(&format!("Credential list: plugin_clsid valid: {}, credential_count: {}", 
                !credentials_list.plugin_clsid.is_null(), credentials_list.credential_count));
            
            let result = unsafe { api(&mut credentials_list) };

            if result.is_err() {
                let error_code = result.0;
                debug_log(&format!("API call failed with HRESULT: 0x{:x}", error_code));
                return Err(format!(
                    "Error: Error response from EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials()\nHRESULT: 0x{:x}\n{}",
                    error_code, result.message()
                ));
            }

            debug_log("API call succeeded");
            Ok(())
        },
        None => {
            debug_log("Failed to load EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials function from webauthn.dll");
            Err(String::from("Error: Can't complete add_credentials(), as the function EXPERIMENTAL_WebAuthNPluginAuthenticatorAddCredentials can't be loaded."))
        }
    }
}

pub fn remove_credentials(
    mut credentials_list: ExperimentalWebAuthnPluginCredentialDetailsList,
) -> std::result::Result<(), String> {
    let result = unsafe {
        delay_load::<EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveCredentials"),
        )
    };

    match result {
        Some(api) => {
            let result = unsafe { api(&mut credentials_list) };

            if result.is_err() {
                return Err(format!(
                    "Error: Error response from EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveCredentials()\n{}",
                    result.message()
                ));
            }

            Ok(())
        },
        None => {
            Err(String::from("Error: Can't complete remove_credentials(), as the function EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveCredentials can't be loaded."))
        }
    }
}

pub fn get_all_credentials(
    plugin_clsid: String,
) -> std::result::Result<Option<ExperimentalWebAuthnPluginCredentialDetailsList>, String> {
    let result = unsafe {
        delay_load::<EXPERIMENTAL_WebAuthNPluginAuthenticatorGetAllCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("EXPERIMENTAL_WebAuthNPluginAuthenticatorGetAllCredentials"),
        )
    };

    match result {
        Some(api) => {
            // Create the wide string and keep it alive during the API call
            let clsid_wide = plugin_clsid.to_utf16();
            let mut credentials_list_ptr: *mut ExperimentalWebAuthnPluginCredentialDetailsList = std::ptr::null_mut();
            
            let result = unsafe { api(clsid_wide.as_ptr(), &mut credentials_list_ptr) };

            if result.is_err() {
                return Err(format!(
                    "Error: Error response from EXPERIMENTAL_WebAuthNPluginAuthenticatorGetAllCredentials()\n{}",
                    result.message()
                ));
            }

            if credentials_list_ptr.is_null() {
                Ok(None)
            } else {
                // Note: The caller is responsible for managing the memory of the returned list
                Ok(Some(unsafe { *credentials_list_ptr }))
            }
        },
        None => {
            Err(String::from("Error: Can't complete get_all_credentials(), as the function EXPERIMENTAL_WebAuthNPluginAuthenticatorGetAllCredentials can't be loaded."))
        }
    }
}

pub fn remove_all_credentials(
    plugin_clsid: String,
) -> std::result::Result<(), String> {
    debug_log("Loading EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveAllCredentials function...");
    
    let result = unsafe {
        delay_load::<EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveAllCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveAllCredentials"),
        )
    };

    match result {
        Some(api) => {
            debug_log("Function loaded successfully, calling API...");
            // Create the wide string and keep it alive during the API call
            let clsid_wide = plugin_clsid.to_utf16();
            
            let result = unsafe { api(clsid_wide.as_ptr()) };

            if result.is_err() {
                let error_code = result.0;
                debug_log(&format!("API call failed with HRESULT: 0x{:x}", error_code));
                
                return Err(format!(
                    "Error: Error response from EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveAllCredentials()\nHRESULT: 0x{:x}\n{}",
                    error_code, result.message()
                ));
            }

            debug_log("API call succeeded");
            Ok(())
        },
        None => {
            debug_log("Failed to load EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveAllCredentials function from webauthn.dll");
            Err(String::from("Error: Can't complete remove_all_credentials(), as the function EXPERIMENTAL_WebAuthNPluginAuthenticatorRemoveAllCredentials can't be loaded."))
        }
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CREDENTIAL_EX {
    pub dwVersion: u32,
    pub cbId: u32,
    pub pbId: *const u8,
    pub pwszCredentialType: *const u16, // LPCWSTR
    pub dwTransports: u32,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CREDENTIAL_LIST {
    pub cCredentials: u32,
    pub ppCredentials: *const *const WEBAUTHN_CREDENTIAL_EX,
}
