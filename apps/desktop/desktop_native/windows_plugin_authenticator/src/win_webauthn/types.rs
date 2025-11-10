//! Types and functions defined in the Windows WebAuthn API.

use std::{collections::HashSet, ptr::NonNull};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ciborium::Value;
use windows::{
    core::{GUID, HRESULT},
    Win32::System::LibraryLoader::GetProcAddress,
};
use windows_core::s;

use crate::win_webauthn::{util::WindowsString, Clsid, ErrorKind, WinWebAuthnError};

macro_rules! webauthn_call {
    ($symbol:literal as fn $fn_name:ident($($arg:ident: $arg_type:ty,)+) -> $result_type:ty) => (
        pub(super) fn $fn_name($($arg: $arg_type),*) -> Result<$result_type, WinWebAuthnError> {
            let library = super::util::load_webauthn_lib()?;
            let response = unsafe {
                let address = GetProcAddress(library, s!($symbol)).ok_or(
                    WinWebAuthnError::new(
                        ErrorKind::DllLoad,
                        &format!(
                            "Failed to load function {}",
                            $symbol
                        ),
                    ),
                )?;

                let function: unsafe extern "cdecl" fn(
                    $($arg: $arg_type),*
                ) -> $result_type = std::mem::transmute_copy(&address);
                function($($arg),*)
            };
            super::util::free_webauthn_lib(library)?;
            Ok(response)
        }
    )
}

/// Used when adding a Windows plugin authenticator (stable API).
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS
/// Header File Usage: WebAuthNPluginAddAuthenticator()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
    /// Authenticator Name
    pub(super) pwszAuthenticatorName: *const u16,

    /// Plugin COM ClsId
    pub(super) rclsid: *const GUID,

    /// Plugin RPID
    ///
    /// Required for a nested WebAuthN call originating from a plugin.
    pub(super) pwszPluginRpId: *const u16,

    /// Plugin Authenticator Logo for the Light themes.  base64-encoded SVG 1.1
    ///
    /// The data should be encoded as `UTF16(BASE64(UTF8(svg_text)))`.
    pub(super) pwszLightThemeLogoSvg: *const u16,

    /// Plugin Authenticator Logo for the Dark themes.  base64-encoded SVG 1.1
    ///
    /// The data should be encoded as `UTF16(BASE64(UTF8(svg_text)))`.
    pub(super) pwszDarkThemeLogoSvg: *const u16,

    pub(super) cbAuthenticatorInfo: u32,
    /// CTAP CBOR-encoded authenticatorGetInfo output
    pub(super) pbAuthenticatorInfo: *const u8,

    pub(super) cSupportedRpIds: u32,
    /// List of supported RP IDs (Relying Party IDs).
    ///
    /// Should be null if all RPs are supported.
    pub(super) pbSupportedRpIds: *const *const u16,
}

pub struct PluginAddAuthenticatorOptions {
    /// Authenticator Name
    pub authenticator_name: String,

    /// Plugin COM ClsId
    pub clsid: Clsid,

    /// Plugin RPID
    ///
    /// Required for a nested WebAuthN call originating from a plugin.
    pub rp_id: Option<String>,

    /// Plugin Authenticator Logo for the Light themes.
    ///
    /// String should contain a valid SVG 1.1 document.
    pub light_theme_logo_svg: Option<String>,

    // Plugin Authenticator Logo for the Dark themes. Bytes of SVG 1.1.
    ///
    /// String should contain a valid SVG 1.1 element.
    pub dark_theme_logo_svg: Option<String>,

    /// CTAP authenticatorGetInfo values
    pub authenticator_info: AuthenticatorInfo,

    /// List of supported RP IDs (Relying Party IDs).
    ///
    /// Should be [None] if all RPs are supported.
    pub supported_rp_ids: Option<Vec<String>>,
}

impl PluginAddAuthenticatorOptions {
    pub fn light_theme_logo_b64(&self) -> Option<Vec<u16>> {
        self.light_theme_logo_svg
            .as_ref()
            .map(|svg| Self::encode_svg(&svg))
    }

    pub fn dark_theme_logo_b64(&self) -> Option<Vec<u16>> {
        self.dark_theme_logo_svg
            .as_ref()
            .map(|svg| Self::encode_svg(&svg))
    }

    fn encode_svg(svg: &str) -> Vec<u16> {
        let logo_b64: String = STANDARD.encode(svg);
        logo_b64.to_utf16()
    }
}

/// Used as a response type when adding a Windows plugin authenticator.
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
/// Header File Usage: WebAuthNPluginAddAuthenticator()
///                    WebAuthNPluginFreeAddAuthenticatorResponse()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WebAuthnPluginAddAuthenticatorResponse {
    pub plugin_operation_signing_key_byte_count: u32,
    pub plugin_operation_signing_key: *mut u8,
}

type WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE = WebAuthnPluginAddAuthenticatorResponse;

/// Safe wrapper around [WebAuthnPluginAddAuthenticatorResponse]
#[derive(Debug)]
pub struct PluginAddAuthenticatorResponse {
    inner: NonNull<WebAuthnPluginAddAuthenticatorResponse>,
}

impl PluginAddAuthenticatorResponse {
    pub fn plugin_operation_signing_key(&self) -> &[u8] {
        unsafe {
            let p = &*self.inner.as_ptr();
            std::slice::from_raw_parts(
                p.plugin_operation_signing_key,
                p.plugin_operation_signing_key_byte_count as usize,
            )
        }
    }
}

impl From<NonNull<WebAuthnPluginAddAuthenticatorResponse>> for PluginAddAuthenticatorResponse {
    fn from(value: NonNull<WebAuthnPluginAddAuthenticatorResponse>) -> Self {
        Self { inner: value }
    }
}

impl Drop for PluginAddAuthenticatorResponse {
    fn drop(&mut self) {
        unsafe {
            // SAFETY: This should only fail if:
            // - we cannot load the webauthn.dll, which we already have if we have constructed this type, or
            // - we spelled the function wrong, which is a library error.
            webauthn_plugin_free_add_authenticator_response(self.inner.as_mut())
                .expect("function to load properly");
        }
    }
}

webauthn_call!("WebAuthNPluginAddAuthenticator" as
fn webauthn_plugin_add_authenticator(
    pPluginAddAuthenticatorOptions: *const WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    ppPluginAddAuthenticatorResponse: *mut *mut WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE,
) -> HRESULT);

webauthn_call!("WebAuthNPluginFreeAddAuthenticatorResponse" as
fn webauthn_plugin_free_add_authenticator_response(
    pPluginAddAuthenticatorOptions: *mut WebAuthnPluginAddAuthenticatorResponse,
) -> ());

/// List of its supported protocol versions and extensions, its AAGUID, and
/// other aspects of its overall capabilities.
pub struct AuthenticatorInfo {
    /// List of supported versions.
    pub versions: HashSet<CtapVersion>,

    /// The claimed AAGUID. 16 bytes in length and encoded the same as
    /// MakeCredential AuthenticatorData, as specified in [WebAuthn].
    ///
    /// Note: even though the name has "guid" in it, this is actually an RFC4122
    /// UUID, which is serialized differently than a Windows GUID.
    pub aaguid: Uuid,

    /// List of supported options.
    pub options: Option<HashSet<String>>,

    /// List of supported transports. Values are taken from the
    /// AuthenticatorTransport enum in [WebAuthn]. The list MUST NOT include
    /// duplicate values nor be empty if present. Platforms MUST tolerate
    /// unknown values.
    pub transports: Option<HashSet<String>>,

    /// List of supported algorithms for credential generation, as specified in
    /// [WebAuthn]. The array is ordered from most preferred to least preferred
    /// and MUST NOT include duplicate entries nor be empty if present.
    /// PublicKeyCredentialParameters' algorithm identifiers are values that
    /// SHOULD be registered in the IANA COSE Algorithms registry
    /// [IANA-COSE-ALGS-REG].
    pub algorithms: Option<Vec<PublicKeyCredentialParameters>>,
}

impl AuthenticatorInfo {
    pub fn as_ctap_bytes(&self) -> Result<Vec<u8>, super::WinWebAuthnError> {
        // Create the authenticator info map according to CTAP2 spec
        // Using Vec<(Value, Value)> because that's what ciborium::Value::Map expects
        let mut authenticator_info = Vec::new();

        // 1: versions - Array of supported FIDO versions
        let versions = self
            .versions
            .iter()
            .map(|v| Value::Text(v.into()))
            .collect();
        authenticator_info.push((Value::Integer(1.into()), Value::Array(versions)));

        // 2: extensions - Array of supported extensions (empty for now)
        authenticator_info.push((Value::Integer(2.into()), Value::Array(vec![])));

        // 3: aaguid - 16-byte AAGUID
        authenticator_info.push((
            Value::Integer(3.into()),
            Value::Bytes(self.aaguid.0.to_vec()),
        ));

        // 4: options - Map of supported options
        if let Some(options) = &self.options {
            let options = options
                .iter()
                .map(|o| (Value::Text(o.into()), Value::Bool(true)))
                .collect();
            authenticator_info.push((Value::Integer(4.into()), Value::Map(options)));
        }

        // 9: transports - Array of supported transports
        if let Some(transports) = &self.transports {
            let transports = transports.iter().map(|t| Value::Text(t.clone())).collect();
            authenticator_info.push((Value::Integer(9.into()), Value::Array(transports)));
        }

        // 10: algorithms - Array of supported algorithms
        if let Some(algorithms) = &self.algorithms {
            let algorithms: Vec<Value> = algorithms
                .iter()
                .map(|a| {
                    Value::Map(vec![
                        (Value::Text("alg".to_string()), Value::Integer(a.alg.into())),
                        (Value::Text("type".to_string()), Value::Text(a.typ.clone())),
                    ])
                })
                .collect();
            authenticator_info.push((Value::Integer(10.into()), Value::Array(algorithms)));
        }

        // Encode to CBOR
        let mut buffer = Vec::new();
        ciborium::ser::into_writer(&Value::Map(authenticator_info), &mut buffer).map_err(|e| {
            WinWebAuthnError::with_cause(
                ErrorKind::Serialization,
                "Failed to serialize authenticator info into CBOR",
                e,
            )
        })?;

        Ok(buffer)
    }
}

// A UUID is not the same as a Windows GUID
/// An RFC4122 UUID.
pub struct Uuid([u8; 16]);

impl TryFrom<&str> for Uuid {
    type Error = WinWebAuthnError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let uuid_clean = value.replace("-", "").replace("{", "").replace("}", "");
        if uuid_clean.len() != 32 {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Invalid UUID format",
            ));
        }

        let bytes = uuid_clean
            .chars()
            .collect::<Vec<char>>()
            .chunks(2)
            .map(|chunk| {
                let hex_str: String = chunk.iter().collect();
                u8::from_str_radix(&hex_str, 16).map_err(|_| {
                    WinWebAuthnError::new(
                        ErrorKind::Serialization,
                        &format!("Invalid hex character in UUID: {}", hex_str),
                    )
                })
            })
            .collect::<Result<Vec<u8>, WinWebAuthnError>>()?;

        // SAFETY: We already checked the length of the string before, so this should result in the correct number of bytes.
        let b: [u8; 16] = bytes.try_into().expect("16 bytes to be parsed");
        Ok(Uuid(b))
    }
}

#[derive(Hash, Eq, PartialEq)]
pub enum CtapVersion {
    Fido2_0,
    Fido2_1,
}

pub struct PublicKeyCredentialParameters {
    pub alg: i32,
    pub typ: String,
}

impl From<&CtapVersion> for String {
    fn from(value: &CtapVersion) -> Self {
        match value {
            CtapVersion::Fido2_0 => "FIDO_2_0",
            CtapVersion::Fido2_1 => "FIDO_2_1",
        }
        .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
    #[test]
    fn test_generate_cbor_authenticator_info() {
        let aaguid = Uuid::try_from(AAGUID).unwrap();
        let authenticator_info = AuthenticatorInfo {
            versions: HashSet::from([CtapVersion::Fido2_0, CtapVersion::Fido2_1]),
            aaguid: aaguid,
            options: Some(HashSet::from([
                "rk".to_string(),
                "up".to_string(),
                "uv".to_string(),
            ])),
            transports: Some(HashSet::from([
                "internal".to_string(),
                "hybrid".to_string(),
            ])),
            algorithms: Some(vec![PublicKeyCredentialParameters {
                alg: -7,
                typ: "public-key".to_string(),
            }]),
        };
        let result = authenticator_info.as_ctap_bytes();
        assert!(result.is_ok(), "CBOR generation should succeed");

        let cbor_bytes = result.unwrap();
        assert!(!cbor_bytes.is_empty(), "CBOR bytes should not be empty");

        // Verify the CBOR can be decoded back
        let decoded: Result<Value, _> = ciborium::de::from_reader(&cbor_bytes[..]);
        assert!(decoded.is_ok(), "Generated CBOR should be valid");

        // Verify it's a map with expected keys
        if let Value::Map(map) = decoded.unwrap() {
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(1.into())),
                "Should contain versions (key 1)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(2.into())),
                "Should contain extensions (key 2)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(3.into())),
                "Should contain aaguid (key 3)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(4.into())),
                "Should contain options (key 4)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(9.into())),
                "Should contain transports (key 9)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(10.into())),
                "Should contain algorithms (key 10)"
            );
        } else {
            panic!("CBOR should decode to a map");
        }

        // Print the generated CBOR for verification
        println!("Generated CBOR hex: {}", hex::encode(&cbor_bytes));
    }

    #[test]
    fn test_aaguid_parsing() {
        let result = Uuid::try_from(AAGUID);
        assert!(result.is_ok(), "AAGUID parsing should succeed");

        let aaguid_bytes = result.unwrap();
        assert_eq!(aaguid_bytes.0.len(), 16, "AAGUID should be 16 bytes");
        assert_eq!(aaguid_bytes.0[0], 0xd5, "First byte should be 0xd5");
        assert_eq!(aaguid_bytes.0[1], 0x48, "Second byte should be 0x48");

        // Verify full expected AAGUID
        let expected_hex = "d548826e79b4db40a3d811116f7e8349";
        let expected_bytes = hex::decode(expected_hex).unwrap();
        assert_eq!(
            &aaguid_bytes.0[..],
            expected_bytes,
            "AAGUID should match expected value"
        );
    }
}
