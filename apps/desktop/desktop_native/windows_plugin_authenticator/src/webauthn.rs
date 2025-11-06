/*
    This file exposes safe functions and types for interacting with the stable
    Windows WebAuthn Plugin API defined here:

    https://github.com/microsoft/webauthn/blob/master/webauthnplugin.h
*/

use windows_core::*;

use crate::com_buffer::ComBuffer;
use crate::util::{debug_log, delay_load, WindowsString};

/// Windows WebAuthn Authenticator Options structure
/// Header File Name: _WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnCtapCborAuthenticatorOptions {
    pub version: u32,              // DWORD dwVersion
    pub user_presence: i32,        // LONG lUp: +1=TRUE, 0=Not defined, -1=FALSE
    pub user_verification: i32,    // LONG lUv: +1=TRUE, 0=Not defined, -1=FALSE
    pub require_resident_key: i32, // LONG lRequireResidentKey: +1=TRUE, 0=Not defined, -1=FALSE
}

/// Used when adding a Windows plugin authenticator (stable API).
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS
/// Header File Usage: WebAuthNPluginAddAuthenticator()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnPluginAddAuthenticatorOptions {
    pub authenticator_name: *const u16,   // LPCWSTR
    pub rclsid: *const GUID,              // REFCLSID (changed from string)
    pub rpid: *const u16,                 // LPCWSTR (optional)
    pub light_theme_logo_svg: *const u16, // LPCWSTR (optional, base64 SVG)
    pub dark_theme_logo_svg: *const u16,  // LPCWSTR (optional, base64 SVG)
    pub cbor_authenticator_info_byte_count: u32,
    pub cbor_authenticator_info: *const u8,  // const BYTE*
    pub supported_rp_ids_count: u32,         // NEW in stable
    pub supported_rp_ids: *const *const u16, // NEW in stable: array of LPCWSTR
}

/// Used as a response type when adding a Windows plugin authenticator (stable API).
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
/// Header File Usage: WebAuthNPluginAddAuthenticator()
///                    WebAuthNPluginFreeAddAuthenticatorResponse()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnPluginAddAuthenticatorResponse {
    pub plugin_operation_signing_key_byte_count: u32,
    pub plugin_operation_signing_key: *mut u8,
}

/// Represents a credential.
/// Header File Name: _WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS
/// Header File Usage: WebAuthNPluginAuthenticatorAddCredentials, etc.
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnPluginCredentialDetails {
    pub credential_id_byte_count: u32,
    pub credential_id_pointer: *const u8, // Changed to const in stable
    pub rpid: *const u16,                 // Changed to const (LPCWSTR)
    pub rp_friendly_name: *const u16,     // Changed to const (LPCWSTR)
    pub user_id_byte_count: u32,
    pub user_id_pointer: *const u8,    // Changed to const
    pub user_name: *const u16,         // Changed to const (LPCWSTR)
    pub user_display_name: *const u16, // Changed to const (LPCWSTR)
}

impl WebAuthnPluginCredentialDetails {
    pub fn create_from_bytes(
        credential_id: Vec<u8>,
        rpid: String,
        rp_friendly_name: String,
        user_id: Vec<u8>,
        user_name: String,
        user_display_name: String,
    ) -> Self {
        // Allocate credential_id bytes with COM
        let (credential_id_pointer, credential_id_byte_count) =
            ComBuffer::from_buffer(&credential_id);

        // Allocate user_id bytes with COM
        let (user_id_pointer, user_id_byte_count) = ComBuffer::from_buffer(&user_id);

        // Convert strings to null-terminated wide strings using trait methods
        let (rpid_ptr, _) = rpid.to_com_utf16();
        let (rp_friendly_name_ptr, _) = rp_friendly_name.to_com_utf16();
        let (user_name_ptr, _) = user_name.to_com_utf16();
        let (user_display_name_ptr, _) = user_display_name.to_com_utf16();

        Self {
            credential_id_byte_count,
            credential_id_pointer: credential_id_pointer as *const u8,
            rpid: rpid_ptr as *const u16,
            rp_friendly_name: rp_friendly_name_ptr as *const u16,
            user_id_byte_count,
            user_id_pointer: user_id_pointer as *const u8,
            user_name: user_name_ptr as *const u16,
            user_display_name: user_display_name_ptr as *const u16,
        }
    }
}

// Stable API function signatures - now use REFCLSID and flat arrays
pub type WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        rclsid: *const GUID, // Changed from string to GUID reference
        cCredentialDetails: u32,
        pCredentialDetails: *const WebAuthnPluginCredentialDetails, // Flat array, not list
    ) -> HRESULT;

pub type WebAuthNPluginAuthenticatorRemoveCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        rclsid: *const GUID,
        cCredentialDetails: u32,
        pCredentialDetails: *const WebAuthnPluginCredentialDetails,
    ) -> HRESULT;

pub type WebAuthNPluginAuthenticatorGetAllCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(
        rclsid: *const GUID,
        pcCredentialDetails: *mut u32, // Out param for count
        ppCredentialDetailsArray: *mut *mut WebAuthnPluginCredentialDetails, // Out param for array
    ) -> HRESULT;

pub type WebAuthNPluginAuthenticatorFreeCredentialDetailsArrayFnDeclaration =
    unsafe extern "cdecl" fn(
        cCredentialDetails: u32,
        pCredentialDetailsArray: *mut WebAuthnPluginCredentialDetails,
    );

pub type WebAuthNPluginAuthenticatorRemoveAllCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(rclsid: *const GUID) -> HRESULT;

pub fn add_credentials(
    clsid_guid: GUID,
    credentials: Vec<WebAuthnPluginCredentialDetails>,
) -> std::result::Result<(), String> {
    debug_log("Loading WebAuthNPluginAuthenticatorAddCredentials function...");

    let result = unsafe {
        delay_load::<WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAuthenticatorAddCredentials"),
        )
    };

    match result {
        Some(api) => {
            debug_log("Function loaded successfully, calling API...");
            debug_log(&format!("Adding {} credentials", credentials.len()));

            let credential_count = credentials.len() as u32;
            let credentials_ptr = if credentials.is_empty() {
                std::ptr::null()
            } else {
                credentials.as_ptr()
            };

            let result = unsafe { api(&clsid_guid, credential_count, credentials_ptr) };

            if result.is_err() {
                let error_code = result.0;
                debug_log(&format!("API call failed with HRESULT: 0x{:x}", error_code));
                return Err(format!(
                    "Error: Error response from WebAuthNPluginAuthenticatorAddCredentials()\nHRESULT: 0x{:x}\n{}",
                    error_code, result.message()
                ));
            }

            debug_log("API call succeeded");
            Ok(())
        }
        None => {
            debug_log("Failed to load WebAuthNPluginAuthenticatorAddCredentials function from webauthn.dll");
            Err(String::from("Error: Can't complete add_credentials(), as the function WebAuthNPluginAuthenticatorAddCredentials can't be loaded."))
        }
    }
}

pub fn remove_credentials(
    clsid_guid: GUID,
    credentials: Vec<WebAuthnPluginCredentialDetails>,
) -> std::result::Result<(), String> {
    debug_log("Loading WebAuthNPluginAuthenticatorRemoveCredentials function...");

    let result = unsafe {
        delay_load::<WebAuthNPluginAuthenticatorRemoveCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAuthenticatorRemoveCredentials"),
        )
    };

    match result {
        Some(api) => {
            debug_log(&format!("Removing {} credentials", credentials.len()));

            let credential_count = credentials.len() as u32;
            let credentials_ptr = if credentials.is_empty() {
                std::ptr::null()
            } else {
                credentials.as_ptr()
            };

            let result = unsafe { api(&clsid_guid, credential_count, credentials_ptr) };

            if result.is_err() {
                return Err(format!(
                    "Error: Error response from WebAuthNPluginAuthenticatorRemoveCredentials()\n{}",
                    result.message()
                ));
            }

            Ok(())
        },
        None => {
            Err(String::from("Error: Can't complete remove_credentials(), as the function WebAuthNPluginAuthenticatorRemoveCredentials can't be loaded."))
        }
    }
}

// Helper struct to hold owned credential data
#[derive(Debug, Clone)]
pub struct OwnedCredentialDetails {
    pub credential_id: Vec<u8>,
    pub rpid: String,
    pub rp_friendly_name: String,
    pub user_id: Vec<u8>,
    pub user_name: String,
    pub user_display_name: String,
}

pub fn get_all_credentials(
    clsid_guid: GUID,
) -> std::result::Result<Vec<OwnedCredentialDetails>, String> {
    debug_log("Loading WebAuthNPluginAuthenticatorGetAllCredentials function...");

    let result = unsafe {
        delay_load::<WebAuthNPluginAuthenticatorGetAllCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAuthenticatorGetAllCredentials"),
        )
    };

    match result {
        Some(api) => {
            let mut credential_count: u32 = 0;
            let mut credentials_array_ptr: *mut WebAuthnPluginCredentialDetails = std::ptr::null_mut();

            let result = unsafe { api(&clsid_guid, &mut credential_count, &mut credentials_array_ptr) };

            if result.is_err() {
                return Err(format!(
                    "Error: Error response from WebAuthNPluginAuthenticatorGetAllCredentials()\n{}",
                    result.message()
                ));
            }

            if credentials_array_ptr.is_null() || credential_count == 0 {
                debug_log("No credentials returned");
                return Ok(Vec::new());
            }

            // Deep copy the credential data before Windows frees it
            let credentials_slice = unsafe {
                std::slice::from_raw_parts(credentials_array_ptr, credential_count as usize)
            };

            let mut owned_credentials = Vec::new();
            for cred in credentials_slice {
                unsafe {
                    // Copy credential ID bytes
                    let credential_id = if !cred.credential_id_pointer.is_null() && cred.credential_id_byte_count > 0 {
                        std::slice::from_raw_parts(cred.credential_id_pointer, cred.credential_id_byte_count as usize).to_vec()
                    } else {
                        Vec::new()
                    };

                    // Copy user ID bytes
                    let user_id = if !cred.user_id_pointer.is_null() && cred.user_id_byte_count > 0 {
                        std::slice::from_raw_parts(cred.user_id_pointer, cred.user_id_byte_count as usize).to_vec()
                    } else {
                        Vec::new()
                    };

                    // Copy string fields
                    let rpid = if !cred.rpid.is_null() {
                        String::from_utf16_lossy(std::slice::from_raw_parts(
                            cred.rpid,
                            (0..).position(|i| *cred.rpid.offset(i) == 0).unwrap_or(0)
                        ))
                    } else {
                        String::new()
                    };

                    let rp_friendly_name = if !cred.rp_friendly_name.is_null() {
                        String::from_utf16_lossy(std::slice::from_raw_parts(
                            cred.rp_friendly_name,
                            (0..).position(|i| *cred.rp_friendly_name.offset(i) == 0).unwrap_or(0)
                        ))
                    } else {
                        String::new()
                    };

                    let user_name = if !cred.user_name.is_null() {
                        String::from_utf16_lossy(std::slice::from_raw_parts(
                            cred.user_name,
                            (0..).position(|i| *cred.user_name.offset(i) == 0).unwrap_or(0)
                        ))
                    } else {
                        String::new()
                    };

                    let user_display_name = if !cred.user_display_name.is_null() {
                        String::from_utf16_lossy(std::slice::from_raw_parts(
                            cred.user_display_name,
                            (0..).position(|i| *cred.user_display_name.offset(i) == 0).unwrap_or(0)
                        ))
                    } else {
                        String::new()
                    };

                    owned_credentials.push(OwnedCredentialDetails {
                        credential_id,
                        rpid,
                        rp_friendly_name,
                        user_id,
                        user_name,
                        user_display_name,
                    });
                }
            }

            // Free the array using the Windows API - this frees everything including strings
            free_credential_details_array(credential_count, credentials_array_ptr);

            debug_log(&format!("Retrieved {} credentials", owned_credentials.len()));
            Ok(owned_credentials)
        },
        None => {
            Err(String::from("Error: Can't complete get_all_credentials(), as the function WebAuthNPluginAuthenticatorGetAllCredentials can't be loaded."))
        }
    }
}

fn free_credential_details_array(
    credential_count: u32,
    credentials_array: *mut WebAuthnPluginCredentialDetails,
) {
    if credentials_array.is_null() {
        return;
    }

    let result = unsafe {
        delay_load::<WebAuthNPluginAuthenticatorFreeCredentialDetailsArrayFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAuthenticatorFreeCredentialDetailsArray"),
        )
    };

    if let Some(api) = result {
        unsafe { api(credential_count, credentials_array) };
    } else {
        debug_log("Warning: Could not load WebAuthNPluginAuthenticatorFreeCredentialDetailsArray");
    }
}

pub fn remove_all_credentials(clsid_guid: GUID) -> std::result::Result<(), String> {
    debug_log("Loading WebAuthNPluginAuthenticatorRemoveAllCredentials function...");

    let result = unsafe {
        delay_load::<WebAuthNPluginAuthenticatorRemoveAllCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAuthenticatorRemoveAllCredentials"),
        )
    };

    match result {
        Some(api) => {
            debug_log("Function loaded successfully, calling API...");

            let result = unsafe { api(&clsid_guid) };

            if result.is_err() {
                let error_code = result.0;
                debug_log(&format!("API call failed with HRESULT: 0x{:x}", error_code));

                return Err(format!(
                    "Error: Error response from WebAuthNPluginAuthenticatorRemoveAllCredentials()\nHRESULT: 0x{:x}\n{}",
                    error_code, result.message()
                ));
            }

            debug_log("API call succeeded");
            Ok(())
        }
        None => {
            debug_log("Failed to load WebAuthNPluginAuthenticatorRemoveAllCredentials function from webauthn.dll");
            Err(String::from("Error: Can't complete remove_all_credentials(), as the function WebAuthNPluginAuthenticatorRemoveAllCredentials can't be loaded."))
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
