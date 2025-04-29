/*
    This file exposes the functions and types defined here: https://github.com/microsoft/webauthn/blob/master/experimental/webauthn.h
*/

/// Used when adding a Windows plugin authenticator.
/// Header File Name: _EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS
/// Header File Usage: EXPERIMENTAL_WebAuthNPluginAddAuthenticator()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct ExperimentalWebAuthnPluginAddAuthenticatorOptions {
    pub authenticator_name: *const u16,
    pub com_clsid: *const u16,
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
