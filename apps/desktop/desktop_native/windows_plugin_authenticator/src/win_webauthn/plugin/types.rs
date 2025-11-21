//! Types pertaining to registering a plugin implementation and handling plugin
//! authenticator requests.

use std::{collections::HashSet, fmt::Display, mem::MaybeUninit, ptr::NonNull};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ciborium::Value;
use windows::{
    core::{GUID, HRESULT},
    Win32::{
        Foundation::HWND, System::LibraryLoader::GetProcAddress,
        UI::WindowsAndMessaging::WindowFromPoint,
    },
};
use windows_core::{s, PCWSTR};

use crate::win_webauthn::{
    util::{webauthn_call, ArrayPointerIterator, WindowsString},
    ErrorKind, WinWebAuthnError,
};

use crate::win_webauthn::types::{
    AuthenticatorInfo, CredentialList, CtapTransport, HmacSecretSalt,
    WebAuthnExtensionMakeCredentialOutput, WEBAUTHN_COSE_CREDENTIAL_PARAMETERS,
    WEBAUTHN_CREDENTIAL_ATTESTATION, WEBAUTHN_CREDENTIAL_LIST, WEBAUTHN_EXTENSIONS,
    WEBAUTHN_RP_ENTITY_INFORMATION, WEBAUTHN_USER_ENTITY_INFORMATION,
};

use super::Clsid;

// Plugin Registration types

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

/// Used when adding a Windows plugin authenticator (stable API).
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS
/// Header File Usage: WebAuthNPluginAddAuthenticator()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
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
pub(crate) struct WEBAUTHN_PLUGIN_OPERATION_RESPONSE {
    pub cbEncodedResponse: u32,
    pub pbEncodedResponse: *mut u8,
}

/// Plugin request type enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum WebAuthnPluginRequestType {
    CTAP2_CBOR = 0x01,
}

// MakeCredential types

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST {
    pub dwVersion: u32,
    pub cbRpId: u32,
    pub pbRpId: *const u8,
    pub cbClientDataHash: u32,
    pub pbClientDataHash: *const u8,
    pub pRpInformation: *const WEBAUTHN_RP_ENTITY_INFORMATION,
    pub pUserInformation: *const WEBAUTHN_USER_ENTITY_INFORMATION,
    pub WebAuthNCredentialParameters: WEBAUTHN_COSE_CREDENTIAL_PARAMETERS, // Matches C++ sample
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    pub cbCborExtensionsMap: u32,
    pub pbCborExtensionsMap: *const u8,
    pub pAuthenticatorOptions: *const WebAuthnCtapCborAuthenticatorOptions,
    // Add other fields as needed...
}

#[derive(Debug)]
pub struct PluginMakeCredentialRequest {
    inner: *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
    pub window_handle: HWND,
    pub transaction_id: GUID,
    pub request_signature: Vec<u8>,
}

impl PluginMakeCredentialRequest {
    pub fn client_data_hash(&self) -> Result<&[u8], WinWebAuthnError> {
        if self.as_ref().cbClientDataHash == 0 || self.as_ref().pbClientDataHash.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid client data hash",
            ));
        }
        unsafe {
            Ok(std::slice::from_raw_parts(
                self.as_ref().pbClientDataHash,
                self.as_ref().cbClientDataHash as usize,
            ))
        }
    }

    pub fn rp_information(&self) -> Option<&WEBAUTHN_RP_ENTITY_INFORMATION> {
        let ptr = self.as_ref().pRpInformation;
        if ptr.is_null() {
            return None;
        }
        unsafe { Some(&*ptr) }
    }

    pub fn user_information(&self) -> Option<&WEBAUTHN_USER_ENTITY_INFORMATION> {
        let ptr = self.as_ref().pUserInformation;
        if ptr.is_null() {
            return None;
        }
        unsafe { Some(&*ptr) }
    }

    pub fn pub_key_cred_params(&self) -> WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
        self.as_ref().WebAuthNCredentialParameters
    }

    pub fn exclude_credentials(&self) -> CredentialList {
        self.as_ref().CredentialList
    }

    /// CTAP CBOR extensions map
    pub fn extensions(&self) -> Option<&[u8]> {
        let (len, ptr) = (
            self.as_ref().cbCborExtensionsMap,
            self.as_ref().pbCborExtensionsMap,
        );
        if len == 0 || ptr.is_null() {
            return None;
        }
        unsafe { Some(std::slice::from_raw_parts(ptr, len as usize)) }
    }

    pub fn authenticator_options(&self) -> Option<WebAuthnCtapCborAuthenticatorOptions> {
        let ptr = self.as_ref().pAuthenticatorOptions;
        if ptr.is_null() {
            return None;
        }
        unsafe { Some(*ptr) }
    }
}

impl AsRef<WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST> for PluginMakeCredentialRequest {
    fn as_ref(&self) -> &WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST {
        unsafe { &*self.inner }
    }
}

impl Drop for PluginMakeCredentialRequest {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            // leak memory if we cannot find the free function
            _ = webauthn_free_decoded_make_credential_request(
                self.inner as *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
            );
        }
    }
}

impl TryFrom<NonNull<WEBAUTHN_PLUGIN_OPERATION_REQUEST>> for PluginMakeCredentialRequest {
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
            let mut registration_request = MaybeUninit::uninit();
            webauthn_decode_make_credential_request(
                request.cbEncodedRequest,
                request.pbEncodedRequest,
                registration_request.as_mut_ptr(),
            )?
            .ok()
            .map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Failed to decode get assertion request",
                    err,
                )
            })?;

            let registration_request = registration_request.assume_init();
            Ok(Self {
                inner: registration_request as *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
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

// Windows API function signatures for decoding make credential requests
webauthn_call!("WebAuthNDecodeMakeCredentialRequest" as fn webauthn_decode_make_credential_request(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppMakeCredentialRequest: *mut *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST
) -> HRESULT);

webauthn_call!("WebAuthNFreeDecodedMakeCredentialRequest" as fn webauthn_free_decoded_make_credential_request(
    pMakeCredentialRequest: *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST
) -> ());

pub struct PluginMakeCredentialResponse {
    /// Attestation format type
    pub format_type: String, // PCWSTR

    /// Authenticator data that was created for this credential.
    pub authenticator_data: Vec<u8>,

    ///Encoded CBOR attestation information
    pub attestation_statement: Option<Vec<u8>>,

    // dwAttestationDecodeType: u32,
    /// Following depends on the dwAttestationDecodeType
    ///  WEBAUTHN_ATTESTATION_DECODE_NONE
    ///      NULL - not able to decode the CBOR attestation information
    ///  WEBAUTHN_ATTESTATION_DECODE_COMMON
    ///      PWEBAUTHN_COMMON_ATTESTATION;
    // pub pvAttestationDecode: *mut u8,

    /// The CBOR-encoded Attestation Object to be returned to the RP.
    pub attestation_object: Option<Vec<u8>>,

    /// The CredentialId bytes extracted from the Authenticator Data.
    /// Used by Edge to return to the RP.
    pub credential_id: Option<Vec<u8>>,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_2
    //
    /// Since VERSION 2
    pub extensions: Option<Vec<WebAuthnExtensionMakeCredentialOutput>>,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_3
    //
    /// One of the WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transport that was used.
    pub used_transport: CtapTransport,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_4
    //
    pub ep_att: bool,
    pub large_blob_supported: bool,
    pub resident_key: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_5
    //
    pub prf_enabled: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_6
    //
    pub unsigned_extension_outputs: Option<Vec<u8>>,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_7
    //
    pub hmac_secret: Option<HmacSecretSalt>,

    /// ThirdPartyPayment Credential or not.
    pub third_party_payment: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8
    //
    /// Multiple WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transports that are supported.
    pub transports: Option<Vec<CtapTransport>>,

    /// UTF-8 encoded JSON serialization of the client data.
    pub client_data_json: Option<Vec<u8>>,

    /// UTF-8 encoded JSON serialization of the RegistrationResponse.
    pub registration_response_json: Option<Vec<u8>>,
}

impl PluginMakeCredentialResponse {
    pub fn to_ctap_response(self) -> Result<Vec<u8>, WinWebAuthnError> {
        let attestation = self.try_into()?;
        let mut response_len = 0;
        let mut response_ptr = std::ptr::null_mut();
        webauthn_encode_make_credential_response(
            &attestation,
            &mut response_len,
            &mut response_ptr,
        )?
        .ok()
        .map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "WebAuthNEncodeMakeCredentialResponse() failed",
                err,
            )
        })?;

        if response_ptr.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received null pointer from WebAuthNEncodeMakeCredentialResponse",
            ));
        }
        let response = unsafe {
            Vec::from_raw_parts(response_ptr, response_len as usize, response_len as usize)
        };

        Ok(response)
    }
}

impl TryFrom<PluginMakeCredentialResponse> for WEBAUTHN_CREDENTIAL_ATTESTATION {
    type Error = WinWebAuthnError;

    fn try_from(value: PluginMakeCredentialResponse) -> Result<Self, Self::Error> {
        // Convert format type to UTF-16
        let format_type_utf16 = value.format_type.to_utf16();
        let pwszFormatType = format_type_utf16.as_ptr();
        std::mem::forget(format_type_utf16);

        // Get authenticator data pointer and length
        let pbAuthenticatorData = value.authenticator_data.as_ptr();
        let cbAuthenticatorData = value.authenticator_data.len() as u32;
        std::mem::forget(value.authenticator_data);

        // Get optional attestation statement pointer and length
        let (pbAttestation, cbAttestation) = match value.attestation_statement.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };
        std::mem::forget(value.attestation_statement);

        // Get optional attestation object pointer and length
        let (pbAttestationObject, cbAttestationObject) = match value.attestation_object.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };
        std::mem::forget(value.attestation_object);

        // Get optional credential ID pointer and length
        let (pbCredentialId, cbCredentialId) = match value.credential_id.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };
        std::mem::forget(value.credential_id);

        // Convert extensions (TODO: implement proper extension conversion)
        let extensions = WEBAUTHN_EXTENSIONS {
            cExtensions: 0,
            pExtensions: std::ptr::null(),
        };

        // Convert used transport enum to bitmask
        let dwUsedTransport = value.used_transport as u32;

        // Get optional unsigned extension outputs pointer and length
        let (pbUnsignedExtensionOutputs, cbUnsignedExtensionOutputs) =
            match value.unsigned_extension_outputs.as_ref() {
                Some(data) => (data.as_ptr(), data.len() as u32),
                None => (std::ptr::null(), 0),
            };
        std::mem::forget(value.unsigned_extension_outputs);

        // Convert optional HMAC secret (TODO: implement proper conversion)
        let pHmacSecret = std::ptr::null();

        // Convert optional transports to bitmask
        let dwTransports = value
            .transports
            .as_ref()
            .map_or(0, |t| t.iter().map(|transport| *transport as u32).sum());

        // Get optional client data JSON pointer and length
        let (pbClientDataJSON, cbClientDataJSON) = match value.client_data_json.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };
        std::mem::forget(value.client_data_json);

        // Get optional registration response JSON pointer and length
        let (pbRegistrationResponseJSON, cbRegistrationResponseJSON) =
            match value.registration_response_json.as_ref() {
                Some(data) => (data.as_ptr(), data.len() as u32),
                None => (std::ptr::null(), 0),
            };
        std::mem::forget(value.registration_response_json);

        let attestation = WEBAUTHN_CREDENTIAL_ATTESTATION {
            // Use version 8 to include all fields
            dwVersion: 8,
            pwszFormatType,
            cbAuthenticatorData,
            pbAuthenticatorData,
            cbAttestation,
            pbAttestation,
            // TODO: Support decode type. Just using WEBAUTHN_ATTESTATION_DECODE_NONE (0) for now.
            dwAttestationDecodeType: 0,
            pvAttestationDecode: std::ptr::null(),
            cbAttestationObject,
            pbAttestationObject,
            cbCredentialId,
            pbCredentialId,
            Extensions: extensions,
            dwUsedTransport,
            bEpAtt: value.ep_att,
            bLargeBlobSupported: value.large_blob_supported,
            bResidentKey: value.resident_key,
            bPrfEnabled: value.prf_enabled,
            cbUnsignedExtensionOutputs,
            pbUnsignedExtensionOutputs,
            pHmacSecret,
            bThirdPartyPayment: value.third_party_payment,
            dwTransports,
            cbClientDataJSON,
            pbClientDataJSON,
            cbRegistrationResponseJSON,
            pbRegistrationResponseJSON,
        };
        Ok(attestation)
    }
}

webauthn_call!("WebAuthNEncodeMakeCredentialResponse" as fn webauthn_encode_make_credential_response(
    cbEncoded: *const WEBAUTHN_CREDENTIAL_ATTESTATION,
    pbEncoded: *mut u32,
    response_bytes: *mut *mut u8
) -> HRESULT);

// GetAssertion types

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
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

    pub fn allow_credentials(&self) -> CredentialList {
        self.as_ref().CredentialList
    }

    // TODO: Support extensions
    // pub fn extensions(&self) -> Options<Extensions> {}

    pub fn authenticator_options(&self) -> Option<WebAuthnCtapCborAuthenticatorOptions> {
        let ptr = self.as_ref().pAuthenticatorOptions;
        if ptr.is_null() {
            return None;
        }
        unsafe { Some(*ptr) }
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

// CancelOperation Types
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
