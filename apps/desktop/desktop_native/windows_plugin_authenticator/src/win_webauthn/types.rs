//! Types and functions defined in the Windows WebAuthn API.

use std::{collections::HashSet, ptr::NonNull};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ciborium::Value;
use windows::{
    core::{GUID, HRESULT},
    Win32::{Foundation::HWND, System::LibraryLoader::GetProcAddress},
};
use windows_core::{s, PCWSTR};

use crate::win_webauthn::{util::WindowsString, Clsid, ErrorKind, WinWebAuthnError};

macro_rules! webauthn_call {
    ($symbol:literal as fn $fn_name:ident($($arg:ident: $arg_type:ty),+) -> $result_type:ty) => (
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
    ppPluginAddAuthenticatorResponse: *mut *mut WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
) -> HRESULT);

webauthn_call!("WebAuthNPluginFreeAddAuthenticatorResponse" as
fn webauthn_plugin_free_add_authenticator_response(
    pPluginAddAuthenticatorOptions: *mut WebAuthnPluginAddAuthenticatorResponse
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

/// Used when creating and asserting credentials.
/// Header File Name: _WEBAUTHN_PLUGIN_OPERATION_REQUEST
/// Header File Usage: MakeCredential()
///                    GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_PLUGIN_OPERATION_REQUEST {
    /// Window handle to client that requesting a WebAuthn credential.
    pub hWnd: HWND,
    pub transactionId: GUID,
    pub cbRequestSignature: u32,
    /// Signature over request made with the signing key created during authenticator registration.
    pub pbRequestSignature: *mut u8,
    pub requestType: WebAuthnPluginRequestType,
    pub cbEncodedRequest: u32,
    pub pbEncodedRequest: *const u8,
}

/// Used as a response when creating and asserting credentials.
/// Header File Name: _WEBAUTHN_PLUGIN_OPERATION_RESPONSE
/// Header File Usage: MakeCredential()
///                    GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_PLUGIN_OPERATION_RESPONSE {
    pub cbEncodedResponse: u32,
    pub pbEncodedResponse: *mut u8,
}

/// Plugin request type enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum WebAuthnPluginRequestType {
    CTAP2_CBOR = 0x01,
}

#[derive(Debug)]
pub struct PluginMakeCredentialRequest {}
// pub struct PluginMakeCredentialResponse {}

// Windows API types for WebAuthn (from webauthn.h.sample)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
    pub dwVersion: u32,
    pub pwszRpId: *const u16, // PCWSTR
    pub cbRpId: u32,
    pub pbRpId: *const u8,
    pub cbClientDataHash: u32,
    pub pbClientDataHash: *const u8,
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    pub cbCborExtensionsMap: u32,
    pub pbCborExtensionsMap: *const u8,
    pub pAuthenticatorOptions: *const WebAuthnCtapCborAuthenticatorOptions,
    // Add other fields as needed...
}

#[derive(Debug)]
pub struct PluginGetAssertionRequest {
    inner: *const WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
    pub window_handle: HWND,
    pub transaction_id: GUID,
    pub request_signature: Vec<u8>,
}

impl PluginGetAssertionRequest {
    pub fn rp_id(&self) -> &str {
        unsafe {
            let request = &*self.inner;
            let slice = std::slice::from_raw_parts(request.pbRpId, request.cbRpId as usize);
            str::from_utf8_unchecked(slice)
        }
    }

    pub fn client_data_hash(&self) -> &[u8] {
        let inner = self.as_ref();
        // SAFETY: Verified by Windows
        unsafe {
            std::slice::from_raw_parts(inner.pbClientDataHash, inner.cbClientDataHash as usize)
        }
    }

    pub fn credential_list(&self) -> CredentialList {
        self.as_ref().CredentialList
    }

    // TODO: Support extensions
    // pub fn extensions(&self) -> Options<Extensions> {}

    pub fn authenticator_options(&self) -> WebAuthnCtapCborAuthenticatorOptions {
        unsafe { *self.as_ref().pAuthenticatorOptions }
    }
}

impl AsRef<WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST> for PluginGetAssertionRequest {
    fn as_ref(&self) -> &WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
        unsafe { &*self.inner }
    }
}

impl Drop for PluginGetAssertionRequest {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            // leak memory if we cannot find the free function
            _ = webauthn_free_decoded_get_assertion_request(
                self.inner as *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
            );
        }
    }
}

impl TryFrom<NonNull<WEBAUTHN_PLUGIN_OPERATION_REQUEST>> for PluginGetAssertionRequest {
    type Error = WinWebAuthnError;

    fn try_from(value: NonNull<WEBAUTHN_PLUGIN_OPERATION_REQUEST>) -> Result<Self, Self::Error> {
        unsafe {
            let request = value.as_ref();
            if !matches!(request.requestType, WebAuthnPluginRequestType::CTAP2_CBOR) {
                return Err(WinWebAuthnError::new(
                    ErrorKind::Serialization,
                    "Unknown plugin operation request type",
                ));
            }
            let mut assertion_request: *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST =
                std::ptr::null_mut();
            webauthn_decode_get_assertion_request(
                request.cbEncodedRequest,
                request.pbEncodedRequest,
                &mut assertion_request,
            )?
            .ok()
            .map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Failed to decode get assertion request",
                    err,
                )
            })?;
            Ok(Self {
                inner: assertion_request as *const WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
                window_handle: request.hWnd,
                transaction_id: request.transactionId,
                request_signature: Vec::from_raw_parts(
                    request.pbRequestSignature,
                    request.cbEncodedRequest as usize,
                    request.cbEncodedRequest as usize,
                ),
            })
        }
    }
}
// Windows API function signatures for decoding get assertion requests
webauthn_call!("WebAuthNDecodeGetAssertionRequest" as fn webauthn_decode_get_assertion_request(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppGetAssertionRequest: *mut *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST
) -> HRESULT);

webauthn_call!("WebAuthNFreeDecodedGetAssertionRequest" as fn webauthn_free_decoded_get_assertion_request(
    pGetAssertionRequest: *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST
) -> ());

// pub struct PluginGetAssertionResponse {}

pub(super) struct WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST {
    transactionId: GUID,
    cbRequestSignature: u32,
    pbRequestSignature: *const u8,
}

pub struct PluginCancelOperationRequest {
    inner: NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>,
}

impl PluginCancelOperationRequest {
    /// Request transaction ID
    fn transaction_id(&self) -> GUID {
        self.as_ref().transactionId
    }

    /// Request signature.
    fn request_signature(&self) -> &[u8] {
        unsafe {
            std::slice::from_raw_parts(
                self.as_ref().pbRequestSignature,
                self.as_ref().cbRequestSignature as usize,
            )
        }
    }
}

impl AsRef<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST> for PluginCancelOperationRequest {
    fn as_ref(&self) -> &WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST {
        // SAFETY: Pointer is received from Windows so we assume it is correct.
        unsafe { self.inner.as_ref() }
    }
}

impl From<NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>> for PluginCancelOperationRequest {
    fn from(value: NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>) -> Self {
        Self { inner: value }
    }
}

/// Plugin lock status enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum PluginLockStatus {
    PluginLocked = 0,
    PluginUnlocked = 1,
}
struct CredentialId(Vec<u8>);

impl TryFrom<Vec<u8>> for CredentialId {
    type Error = WinWebAuthnError;

    fn try_from(value: Vec<u8>) -> Result<Self, Self::Error> {
        if value.len() > 1023 {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                &format!(
                    "Credential ID exceeds maximum length of 1023, received {}",
                    value.len()
                ),
            ));
        }
        Ok(CredentialId(value))
    }
}

impl AsRef<[u8]> for CredentialId {
    fn as_ref(&self) -> &[u8] {
        self.0.as_ref()
    }
}
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CREDENTIAL_EX {
    dwVersion: u32,
    cbId: u32,
    pbId: *const u8,
    pwszCredentialType: *const u16, // LPCWSTR
    dwTransports: u32,
}

impl WEBAUTHN_CREDENTIAL_EX {
    pub fn credential_id(&self) -> Option<&[u8]> {
        if self.cbId == 0 || self.pbId.is_null() {
            None
        } else {
            unsafe { Some(std::slice::from_raw_parts(self.pbId, self.cbId as usize)) }
        }
    }

    pub fn credential_type(&self) -> Result<String, WinWebAuthnError> {
        if self.pwszCredentialType.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid credential ID",
            ));
        }
        unsafe {
            PCWSTR(self.pwszCredentialType).to_string().map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Invalid credential ID",
                    err,
                )
            })
        }
    }

    pub fn transports(&self) -> Vec<CtapTransport> {
        let mut transports = Vec::new();
        let mut t = self.dwTransports;
        if t == 0 {
            return transports;
        };
        const TRANSPORTS: [CtapTransport; 7] = [
            CtapTransport::Usb,
            CtapTransport::Nfc,
            CtapTransport::Ble,
            CtapTransport::Test,
            CtapTransport::Internal,
            CtapTransport::Hybrid,
            CtapTransport::SmartCard,
        ];
        for a in TRANSPORTS {
            if t == 0 {
                break;
            }
            if a as u32 & t > 0 {
                transports.push(a.clone());
                t -= a as u32;
            }
        }
        transports
    }
}

pub struct CredentialEx {
    inner: NonNull<WEBAUTHN_CREDENTIAL_EX>,
}

impl CredentialEx {
    fn new_for_com(
        version: u32,
        id: &CredentialId,
        credential_type: &str,
        transports: &[CtapTransport],
    ) -> Self {
        let (pwszCredentialType, _) = credential_type.to_com_utf16();
        let (pbId, cbId) = ComBuffer::from_buffer(&id);
        let ptr = unsafe {
            let mut uninit: MaybeUninit<WEBAUTHN_CREDENTIAL_EX> = MaybeUninit::uninit();
            let ptr = uninit.as_mut_ptr();
            std::ptr::write(
                ptr,
                WEBAUTHN_CREDENTIAL_EX {
                    dwVersion: version,
                    cbId,
                    pbId,
                    pwszCredentialType,
                    dwTransports: transports.iter().map(|t| t.clone() as u32).sum(),
                },
            );
            NonNull::new_unchecked(ptr)
        };
        Self { inner: ptr }
    }
}

impl AsRef<WEBAUTHN_CREDENTIAL_EX> for CredentialEx {
    fn as_ref(&self) -> &WEBAUTHN_CREDENTIAL_EX {
        // SAFETY: We initialize memory manually in constructors.
        unsafe { self.inner.as_ref() }
    }
}

impl From<NonNull<WEBAUTHN_CREDENTIAL_EX>> for CredentialEx {
    fn from(value: NonNull<WEBAUTHN_CREDENTIAL_EX>) -> Self {
        Self { inner: value }
    }
}

#[repr(u32)]
#[derive(Clone, Copy)]
pub enum CtapTransport {
    Usb = 1,
    Nfc = 2,
    Ble = 4,
    Test = 8,
    Internal = 0x10,
    Hybrid = 0x20,
    SmartCard = 0x40,
}
/// Windows WebAuthn Authenticator Options structure
/// Header File Name: _WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WebAuthnCtapCborAuthenticatorOptions {
    dwVersion: u32,
    // LONG lUp: +1=TRUE, 0=Not defined, -1=FALSE
    lUp: i32,
    // LONG lUv: +1=TRUE, 0=Not defined, -1=FALSE
    lUv: i32,
    // LONG lRequireResidentKey: +1=TRUE, 0=Not defined, -1=FALSE
    lRequireResidentKey: i32,
}

impl WebAuthnCtapCborAuthenticatorOptions {
    pub fn version(&self) -> u32 {
        self.dwVersion
    }

    pub fn user_presence(&self) -> Option<bool> {
        Self::to_optional_bool(self.lUp)
    }

    pub fn user_verification(&self) -> Option<bool> {
        Self::to_optional_bool(self.lUv)
    }

    pub fn require_resident_key(&self) -> Option<bool> {
        Self::to_optional_bool(self.lRequireResidentKey)
    }

    fn to_optional_bool(value: i32) -> Option<bool> {
        match value {
            x if x > 0 => Some(true),
            x if x < 0 => Some(false),
            _ => None,
        }
    }
}
type WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS = WebAuthnCtapCborAuthenticatorOptions;

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct CredentialList {
    pub cCredentials: u32,
    pub ppCredentials: *const *const WEBAUTHN_CREDENTIAL_EX,
}

type WEBAUTHN_CREDENTIAL_LIST = CredentialList;
pub struct CredentialListIterator<'a> {
    pos: usize,
    list: &'a [*const WEBAUTHN_CREDENTIAL_EX],
}

impl<'a> Iterator for CredentialListIterator<'a> {
    type Item = &'a WEBAUTHN_CREDENTIAL_EX;

    fn next(&mut self) -> Option<Self::Item> {
        let current = self.list.get(self.pos);
        self.pos += 1;
        current.and_then(|c| unsafe { c.as_ref() })
    }
}

impl CredentialList {
    pub fn iter(&self) -> CredentialListIterator<'_> {
        unsafe {
            CredentialListIterator {
                pos: 0,
                list: std::slice::from_raw_parts(self.ppCredentials, self.cCredentials as usize),
            }
        }
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
