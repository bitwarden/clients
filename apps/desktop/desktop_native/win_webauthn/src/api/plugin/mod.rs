//! Safe wrappers types and functions around raw webauthn.dll functions defined in `pluginauthenticator.h` and `webauthnplugin.h`.

mod com;

use std::{mem::MaybeUninit, num::NonZeroU32, ptr::NonNull};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use windows::{
    core::{BOOL, GUID, HRESULT},
    Win32::{Foundation::HWND, System::Com::CoTaskMemFree},
};

use crate::{CredentialId, ErrorKind, WinWebAuthnError};

pub use super::sys::plugin::PLUGIN_LOCK_STATUS as PluginLockStatus;

use super::{
    sys::{
        crypto::{self, Signature},
        plugin::{
            webauthn_decode_get_assertion_request, webauthn_decode_make_credential_request,
            webauthn_encode_make_credential_response, webauthn_free_decoded_get_assertion_request,
            webauthn_free_decoded_make_credential_request, webauthn_plugin_add_authenticator,
            webauthn_plugin_authenticator_add_credentials,
            webauthn_plugin_free_add_authenticator_response,
            WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS, WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
            WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST, WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
            WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE, WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
            WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS, WEBAUTHN_PLUGIN_OPERATION_REQUEST,
            WEBAUTHN_PLUGIN_REQUEST_TYPE,
        },
        WEBAUTHN_COSE_CREDENTIAL_PARAMETER, WEBAUTHN_COSE_CREDENTIAL_PARAMETERS,
        WEBAUTHN_CREDENTIAL_ATTESTATION, WEBAUTHN_CREDENTIAL_LIST, WEBAUTHN_EXTENSIONS,
        WEBAUTHN_RP_ENTITY_INFORMATION, WEBAUTHN_USER_ENTITY_INFORMATION,
    },
    webauthn::{
        AuthenticatorInfo, CredentialEx, CtapTransport, HmacSecretSalt, RpEntityInformation,
        UserEntityInformation, UserId, WebAuthnExtensionMakeCredentialOutput,
    },
    WindowsString,
};

pub(crate) use com::register_server;
use com::ComBuffer;

#[derive(Clone, Copy)]
pub struct Clsid(GUID);

impl TryFrom<&str> for Clsid {
    type Error = WinWebAuthnError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        // Remove hyphens and parse as hex
        let clsid_clean = value.replace("-", "").replace("{", "").replace("}", "");
        if clsid_clean.len() != 32 {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Invalid CLSID format",
            ));
        }

        // Convert to u128 and create GUID
        let clsid_u128 = u128::from_str_radix(&clsid_clean, 16).map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::Serialization,
                "Failed to parse CLSID as hex",
                err,
            )
        })?;

        let clsid = Clsid(GUID::from_u128(clsid_u128));
        Ok(clsid)
    }
}

// Plugin Registration types

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

pub type WebAuthnCtapCborAuthenticatorOptions = WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS;

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
    fn light_theme_logo_b64(&self) -> Option<Vec<u16>> {
        self.light_theme_logo_svg
            .as_ref()
            .map(|svg| Self::encode_svg(svg))
    }

    fn dark_theme_logo_b64(&self) -> Option<Vec<u16>> {
        self.dark_theme_logo_svg
            .as_ref()
            .map(|svg| Self::encode_svg(svg))
    }

    fn encode_svg(svg: &str) -> Vec<u16> {
        let logo_b64: String = STANDARD.encode(svg);
        logo_b64.to_utf16()
    }
}

pub(super) struct PluginAddAuthenticatorOptionsRaw {
    pub(super) inner: WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    _clsid: Box<GUID>,
    _authenticator_name: Vec<u16>,
    _rp_id: Option<Vec<u16>>,
    _light_logo_b64: Option<Vec<u16>>,
    _dark_logo_b64: Option<Vec<u16>>,
    _authenticator_info: Vec<u8>,
    _supported_rp_ids: Option<Vec<Vec<u16>>>,
    _supported_rp_id_ptrs: Option<Vec<*const u16>>,
}

impl TryFrom<&PluginAddAuthenticatorOptions> for PluginAddAuthenticatorOptionsRaw {
    type Error = WinWebAuthnError;

    fn try_from(value: &PluginAddAuthenticatorOptions) -> Result<Self, Self::Error> {
        let rclsid = Box::new(value.clsid.0);

        let authenticator_name = value.authenticator_name.to_utf16();

        let rp_id = value.rp_id.as_deref().map(WindowsString::to_utf16);

        let light_logo_b64 = value.light_theme_logo_b64();
        let dark_logo_b64 = value.dark_theme_logo_b64();

        let authenticator_info = value.authenticator_info.as_ctap_bytes()?;

        let supported_rp_ids: Option<Vec<Vec<u16>>> = value
            .supported_rp_ids
            .as_ref()
            .map(|ids| ids.iter().map(|id| id.to_utf16()).collect());
        let supported_rp_id_ptrs: Option<Vec<*const u16>> = supported_rp_ids
            .as_ref()
            .map(|ids| ids.iter().map(Vec::as_ptr).collect());

        let inner = WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
            pwszAuthenticatorName: authenticator_name.as_ptr(),
            rclsid: &value.clsid.0,
            pwszPluginRpId: rp_id.as_ref().map_or(std::ptr::null(), |v| v.as_ptr()),
            pwszLightThemeLogoSvg: light_logo_b64
                .as_ref()
                .map_or(std::ptr::null(), |v| v.as_ptr()),
            pwszDarkThemeLogoSvg: dark_logo_b64
                .as_ref()
                .map_or(std::ptr::null(), |v| v.as_ptr()),
            cbAuthenticatorInfo: authenticator_info.len() as u32,
            pbAuthenticatorInfo: authenticator_info.as_ptr(),
            cSupportedRpIds: supported_rp_id_ptrs
                .as_ref()
                .map_or(0, |ids| ids.len() as u32),
            pbSupportedRpIds: supported_rp_id_ptrs
                .as_ref()
                .map_or(std::ptr::null(), |v| v.as_ptr()),
        };
        Ok(Self {
            inner,
            _clsid: rclsid,
            _authenticator_name: authenticator_name,
            _rp_id: rp_id,
            _light_logo_b64: light_logo_b64,
            _dark_logo_b64: dark_logo_b64,
            _authenticator_info: authenticator_info,
            _supported_rp_ids: supported_rp_ids,
            _supported_rp_id_ptrs: supported_rp_id_ptrs,
        })
    }
}

type WebAuthnPluginAddAuthenticatorResponse = WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE;

pub(super) fn add_authenticator(
    options: &PluginAddAuthenticatorOptionsRaw,
) -> Result<PluginAddAuthenticatorResponse, WinWebAuthnError> {
    let raw_response = {
        let mut raw_response = MaybeUninit::uninit();
        // SAFETY: We are holding references to all the input data beyond the OS call, so it is
        // valid during the call.
        let result = unsafe {
            webauthn_plugin_add_authenticator(&options.inner, raw_response.as_mut_ptr())?
        };

        result.ok().map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to add authenticator",
                err,
            )
        })?;

        unsafe { raw_response.assume_init() }
    };
    if let Some(response) = NonNull::new(raw_response) {
        // SAFETY: The pointer was allocated by a successful call to
        // webauthn_plugin_add_authenticator, so we trust that it's valid.
        unsafe { Ok(PluginAddAuthenticatorResponse::try_from_ptr(response)) }
    } else {
        Err(WinWebAuthnError::new(
            ErrorKind::WindowsInternal,
            "WebAuthNPluginAddAuthenticatorResponse returned null",
        ))
    }
}

/// Response received when registering a plugin
#[derive(Debug)]
pub struct PluginAddAuthenticatorResponse {
    inner: NonNull<WebAuthnPluginAddAuthenticatorResponse>,
}

impl PluginAddAuthenticatorResponse {
    pub fn plugin_operation_signing_key(&self) -> &[u8] {
        // SAFETY: when constructed from Self::try_from_ptr(), the caller
        // ensures that Windows created the pointer, which we trust to create
        // valid responses.
        unsafe {
            std::slice::from_raw_parts(
                self.inner.as_ref().pbOpSignPubKey,
                // SAFETY: We only support 32-bit or 64-bit platforms, so u32 will always fit in
                // usize.
                self.inner.as_ref().cbOpSignPubKey as usize,
            )
        }
    }

    /// # Safety
    /// When calling this function, the caller must ensure that the pointer was
    /// initialized by a successful call to [webauthn_plugin_add_authenticator()].
    pub(super) unsafe fn try_from_ptr(
        value: NonNull<WebAuthnPluginAddAuthenticatorResponse>,
    ) -> Self {
        Self { inner: value }
    }
}

impl Drop for PluginAddAuthenticatorResponse {
    fn drop(&mut self) {
        unsafe {
            // SAFETY: This should only fail if:
            // - we cannot load the webauthn.dll, which we already have if we have constructed this
            //   type, or
            // - we spelled the function wrong, which is a library error.
            webauthn_plugin_free_add_authenticator_response(self.inner.as_mut())
                .expect("function to load properly");
        }
    }
}

// Credential syncing types

/// Credential metadata to sync to Windows Hello credential autofill list.
#[derive(Debug)]
pub struct PluginCredentialDetails {
    /// Credential ID.
    pub credential_id: CredentialId,

    /// Relying party ID.
    pub rp_id: String,

    /// Relying party display name.
    pub rp_friendly_name: Option<String>,

    /// User handle.
    pub user_id: UserId,

    /// User name.
    ///
    /// Corresponds to [`name`](https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialentity-name) field of WebAuthn `PublicKeyCredentialUserEntity`.
    pub user_name: String,

    /// User name.
    ///
    /// Corresponds to [`displayName`](https://www.w3.org/TR/webauthn-3/#dom-publickeycredentialuserentity-displayname) field of WebAuthn `PublicKeyCredentialUserEntity`.
    pub user_display_name: String,
}

pub struct PluginCredentialDetailsRaw {
    inner: WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS,
}

impl From<&PluginCredentialDetails> for PluginCredentialDetailsRaw {
    fn from(value: &PluginCredentialDetails) -> Self {
        // All buffers must be allocated with the COM task allocator to be passed over COM.
        // The receiver is responsible for freeing the COM memory, which is why we leak all the
        // buffers here.

        // Allocate credential_id bytes with COM
        let credential_id_buf = value.credential_id.as_ref().to_com_buffer();

        // Allocate user_id bytes with COM
        let user_id_buf = value.user_id.as_ref().to_com_buffer();
        // Convert strings to null-terminated wide strings using trait methods
        let rp_id_buf: ComBuffer = value.rp_id.to_utf16().to_com_buffer();
        let rp_friendly_name_buf: Option<ComBuffer> = value
            .rp_friendly_name
            .as_ref()
            .map(|display_name| display_name.to_utf16().to_com_buffer());
        let user_name_buf: ComBuffer = (value.user_name.to_utf16()).to_com_buffer();
        let user_display_name_buf: ComBuffer = value.user_display_name.to_utf16().to_com_buffer();
        let inner = WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS {
            credential_id_byte_count: u32::from(value.credential_id.len()),
            credential_id_pointer: credential_id_buf.into_raw(),
            rpid: rp_id_buf.into_raw(),
            rp_friendly_name: rp_friendly_name_buf.map_or(std::ptr::null(), |buf| buf.into_raw()),
            user_id_byte_count: u32::from(value.user_id.len()),
            user_id_pointer: user_id_buf.into_raw(),
            user_name: user_name_buf.into_raw(),
            user_display_name: user_display_name_buf.into_raw(),
        };
        PluginCredentialDetailsRaw { inner }
    }
}

pub(crate) fn add_credentials(
    clsid: &Clsid,
    credentials: &[&PluginCredentialDetailsRaw],
) -> Result<(), WinWebAuthnError> {
    // SAFETY: The pointer to credentials lives longer than the call to
    // webauthn_plugin_authenticator_add_credentials(). The nested
    // buffers are allocated with COM, which the OS is responsible for
    // cleaning up.
    let array = credentials.iter().map(|c| c.inner).to_vec();
    let result = unsafe {
        webauthn_plugin_authenticator_add_credentials(&clsid.0, array.len(), array.as_ptr())
    }?;
    if let Err(err) = result.ok() {
        return Err(WinWebAuthnError::with_cause(
            ErrorKind::WindowsInternal,
            "Failed to add credential list to autofill store",
            err,
        ));
    }
    Ok(())
}

#[derive(Debug)]
pub struct PluginUserVerificationRequest {
    /// Windows handle of the top-level window displayed by the plugin and
    /// currently is in foreground as part of the ongoing WebAuthn operation.
    pub window_handle: HWND,

    /// The WebAuthn transaction id from the WEBAUTHN_PLUGIN_OPERATION_REQUEST
    pub transaction_id: GUID,

    /// The username attached to the credential that is in use for this WebAuthn
    /// operation.
    pub user_name: String,

    /// A text hint displayed on the Windows Hello prompt.
    pub display_hint: Option<String>,
}

/// Response details from user verification.
pub struct PluginUserVerificationResponse {
    pub transaction_id: GUID,
    /// Bytes of the signature over the response.
    pub signature: Vec<u8>,
}

// Plugin Authenticator types

impl WEBAUTHN_PLUGIN_OPERATION_REQUEST {
    /// Extract the signature from an operation request.
    ///
    /// The signature is made by the OS over the SHA-256 hash of the operation
    /// request buffer using the signing key created during authenticator
    /// registration and retrievable via
    /// [webauthn_plugin_get_operation_signing_public_key](crate::plugin::crypto::webauthn_plugin_get_operation_signing_public_key).
    ///
    /// # Safety
    /// The caller must ensure that `request.pbRequestSignature` points to a valid non-null byte
    /// string of length `request.cbRequestSignature`.
    pub(super) unsafe fn signature(&self) -> Signature<'_> {
        // SAFETY: The caller must make sure that the encoded request is valid.
        let signature =
            std::slice::from_raw_parts(self.pbRequestSignature, self.cbRequestSignature as usize);
        Signature::new(signature)
    }
}

// MakeCredential types

#[derive(Debug)]
pub struct PluginMakeCredentialRequest<'a> {
    inner: *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST<'a>,
    pub window_handle: HWND,
    pub transaction_id: GUID,
    pub request_signature: Vec<u8>,
    /// SHA-256 hash of the request.
    ///
    /// Can be used to verify the request later, for example in associated
    /// prompts for user verification.
    pub request_hash: Vec<u8>,
}

impl<'a> PluginMakeCredentialRequest<'a> {
    pub fn client_data_hash(&self) -> &[u8] {
        // SAFETY: clientDataHash is a required field, and when this is
        // constructed using Self::try_from_ptr(), the Windows decode API
        // constructs valid pointers.
        unsafe {
            std::slice::from_raw_parts(
                self.as_ref().pbClientDataHash,
                // SAFETY: we only support Windows versions where usize >= 32
                self.as_ref().cbClientDataHash as usize,
            )
        }
    }

    pub fn rp_information(&self) -> RpEntityInformation<'_> {
        let ptr = self.as_ref().pRpInformation;
        // SAFETY: When this is constructed using Self::try_from_ptr(), the caller must ensure that
        // pRpInformation is valid.
        unsafe { RpEntityInformation::new(ptr.as_ref().expect("pRpInformation to be non-null")) }
    }

    pub fn user_information(&self) -> UserEntityInformation<'_> {
        // SAFETY: When this is constructed using Self::try_from_ptr(), the Windows decode API
        // constructs valid pointers.
        let ptr = self.as_ref().pUserInformation;
        assert!(!ptr.is_null());
        unsafe {
            UserEntityInformation::new(ptr.as_ref().expect("pUserInformation to be non-null"))
        }
    }

    pub fn pub_key_cred_params(&self) -> impl Iterator<Item = &WEBAUTHN_COSE_CREDENTIAL_PARAMETER> {
        // SAFETY: When this is constructed from Self::try_from_ptr(), the Windows decode API
        // constructs valid pointers.
        unsafe { self.as_ref().WebAuthNCredentialParameters.iter() }
    }

    pub fn exclude_credentials(&self) -> impl Iterator<Item = CredentialEx<'_>> {
        // SAFETY: When this is constructed from Self::try_from_ptr(), the Windows decode API
        // constructs valid pointers.
        unsafe { self.as_ref().CredentialList.iter() }
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

    pub fn authenticator_options(&self) -> Option<&WebAuthnCtapCborAuthenticatorOptions> {
        self.as_ref().pAuthenticatorOptions
    }

    /// # Safety
    /// When calling this method, callers must ensure:
    /// - `ptr` must be convertible to a reference.
    /// - `ptr` must have been allocated by Windows COM
    /// - pbEncodedRequest must be non-null and have the length specified in cbEncodedRequest.
    /// - pbRequestSignature must be non-null and have the length specified in cbRequestSignature.
    pub(super) unsafe fn try_from_ptr(
        ptr: NonNull<WEBAUTHN_PLUGIN_OPERATION_REQUEST>,
    ) -> Result<PluginMakeCredentialRequest<'a>, WinWebAuthnError> {
        let request = ptr.as_ref();
        if !matches!(
            request.requestType,
            WEBAUTHN_PLUGIN_REQUEST_TYPE::CTAP2_CBOR
        ) {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Unknown plugin operation request type",
            ));
        }
        let request_slice =
            std::slice::from_raw_parts(request.pbEncodedRequest, request.cbEncodedRequest as usize);
        let request_hash = crypto::hash_sha256(request_slice).map_err(|err| {
            WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "failed to hash request", err)
        })?;
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
                "Failed to decode make credential request",
                err,
            )
        })?;
        // SAFETY: Initialized by successful call to webauthn_decode_make_credential()
        let registration_request = registration_request.assume_init();

        if request.hWnd.is_invalid() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Invalid handle received",
            ));
        }

        Ok(Self {
            inner: registration_request as *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
            window_handle: request.hWnd,
            transaction_id: request.transactionId,
            request_signature: std::slice::from_raw_parts(
                request.pbRequestSignature,
                request.cbRequestSignature as usize,
            )
            .to_vec(),
            request_hash,
        })
    }
}

impl<'a> AsRef<WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST<'a>> for PluginMakeCredentialRequest<'a> {
    fn as_ref(&self) -> &WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST<'a> {
        unsafe { &*self.inner }
    }
}

impl Drop for PluginMakeCredentialRequest<'_> {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            // SAFETY: the caller is responsible for ensuring that this pointer
            // is allocated with an allocator corresponding to this free
            // function.
            unsafe {
                // leak memory if we cannot find the free function
                _ = webauthn_free_decoded_make_credential_request(
                    self.inner as *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
                );
            }
        }
    }
}

// Windows API function signatures for decoding make credential requests

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
    /// Since VERSION 2
    pub extensions: Option<Vec<WebAuthnExtensionMakeCredentialOutput>>,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_3
    /// One of the WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transport that was used.
    pub used_transport: CtapTransport,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_4
    pub ep_att: bool,
    pub large_blob_supported: bool,
    pub resident_key: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_5
    pub prf_enabled: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_6
    pub unsigned_extension_outputs: Option<Vec<u8>>,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_7
    pub hmac_secret: Option<HmacSecretSalt>,

    /// ThirdPartyPayment Credential or not.
    pub third_party_payment: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8
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
        #![allow(non_snake_case)]
        // Convert format type to UTF-16
        let format_type_utf16 = self.format_type.to_utf16();
        let pwszFormatType = format_type_utf16.as_ptr();

        // Get authenticator data pointer and length
        let pbAuthenticatorData = self.authenticator_data.as_ptr();
        let cbAuthenticatorData = self.authenticator_data.len() as u32;

        // Get optional attestation statement pointer and length
        let (pbAttestation, cbAttestation) = match self.attestation_statement.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };

        // Get optional attestation object pointer and length
        let (pbAttestationObject, cbAttestationObject) = match self.attestation_object.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };

        // Get optional credential ID pointer and length
        let (pbCredentialId, cbCredentialId) = match self.credential_id.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };

        // Convert extensions (TODO: implement proper extension conversion)
        let extensions = WEBAUTHN_EXTENSIONS {
            cExtensions: 0,
            pExtensions: std::ptr::null(),
        };

        // Convert used transport enum to bitmask
        let dwUsedTransport = self.used_transport as u32;

        // Get optional unsigned extension outputs pointer and length
        let (pbUnsignedExtensionOutputs, cbUnsignedExtensionOutputs) =
            match self.unsigned_extension_outputs.as_ref() {
                Some(data) => (data.as_ptr(), data.len() as u32),
                None => (std::ptr::null(), 0),
            };

        // Convert optional HMAC secret (TODO: implement proper conversion)
        let pHmacSecret = std::ptr::null();

        // Convert optional transports to bitmask
        let dwTransports = self
            .transports
            .as_ref()
            .map_or(0, |t| t.iter().map(|transport| *transport as u32).sum());

        // Get optional client data JSON pointer and length
        let (pbClientDataJSON, cbClientDataJSON) = match self.client_data_json.as_ref() {
            Some(data) => (data.as_ptr(), data.len() as u32),
            None => (std::ptr::null(), 0),
        };

        // Get optional registration response JSON pointer and length
        let (pbRegistrationResponseJSON, cbRegistrationResponseJSON) =
            match self.registration_response_json.as_ref() {
                Some(data) => (data.as_ptr(), data.len() as u32),
                None => (std::ptr::null(), 0),
            };

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
            bEpAtt: self.ep_att.into(),
            bLargeBlobSupported: self.large_blob_supported.into(),
            bResidentKey: self.resident_key.into(),
            bPrfEnabled: self.prf_enabled.into(),
            cbUnsignedExtensionOutputs,
            pbUnsignedExtensionOutputs,
            pHmacSecret,
            bThirdPartyPayment: self.third_party_payment.into(),
            dwTransports,
            cbClientDataJSON,
            pbClientDataJSON,
            cbRegistrationResponseJSON,
            pbRegistrationResponseJSON,
        };
        let mut response_len = 0;
        let mut response_ptr = std::ptr::null_mut();
        // SAFETY: we construct valid input and check the OS error code before using the returned
        // value.
        unsafe {
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
            let response = std::slice::from_raw_parts(response_ptr, response_len as usize).to_vec();
            // Ideally, we wouldn't have Windows allocate this in COM, and then
            // we reallocate locally and then reallocate for COM.
            CoTaskMemFree(Some(response_ptr.cast()));

            Ok(response)
        }
    }
}

// GetAssertion types

#[derive(Debug)]
pub struct PluginGetAssertionRequest {
    inner: *const WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
    pub window_handle: HWND,
    pub transaction_id: GUID,
    pub request_signature: Vec<u8>,
    pub request_hash: Vec<u8>,
}

impl PluginGetAssertionRequest {
    pub fn rp_id(&self) -> &str {
        let inner = self.as_ref();
        unsafe {
            // SAFETY: we only support platforms where usize >= 32;
            let len = inner.cbRpId as usize;
            let slice = std::slice::from_raw_parts(inner.pbRpId, len);
            // SAFETY: Windows validates that this is valid UTF-8.
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

    pub fn allow_credentials(&self) -> impl Iterator<Item = CredentialEx<'_>> {
        // SAFETY: When this is constructed from Self::try_from_ptr(), the Windows decode API
        // constructs valid pointers.
        unsafe { self.as_ref().CredentialList.iter() }
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

    /// # Safety
    /// When calling this method, callers must ensure:
    /// - `ptr` must be convertible to a reference.
    /// - pbEncodedRequest must be non-null and have the length specified in cbEncodedRequest.
    /// - pbEncodedRequest must point to a valid byte string of a CTAP GetAssertion request.
    pub(super) unsafe fn try_from_ptr(
        value: NonNull<WEBAUTHN_PLUGIN_OPERATION_REQUEST>,
    ) -> Result<PluginGetAssertionRequest, WinWebAuthnError> {
        // SAFETY: caller must ensure that ptr is convertible to a reference.
        let request = value.as_ref();
        if !matches!(
            request.requestType,
            WEBAUTHN_PLUGIN_REQUEST_TYPE::CTAP2_CBOR
        ) {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Unknown plugin operation request type",
            ));
        }
        // SAFETY: Caller must ensure that the pointer and count is valid.
        let request_slice =
            std::slice::from_raw_parts(request.pbEncodedRequest, request.cbEncodedRequest as usize);
        let request_hash = crypto::hash_sha256(request_slice).map_err(|err| {
            WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "failed to hash request", err)
        })?;
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

        if request.hWnd.is_invalid() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Invalid handle received",
            ));
        }

        Ok(Self {
            // SAFETY: Windows should return a valid decoded assertion request struct.
            inner: assertion_request as *const WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
            window_handle: request.hWnd,
            transaction_id: request.transactionId,
            // SAFETY: Caller is expected to ensure that signature buffer parameters are correct.
            request_signature: std::slice::from_raw_parts(
                request.pbRequestSignature,
                request.cbRequestSignature as usize,
            )
            .to_vec(),
            request_hash,
        })
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
            // SAFETY: the caller is responsible for ensuring that this pointer
            // is allocated with an allocator corresponding to this free
            // function.
            unsafe {
                // leak memory if we cannot find the free function
                _ = webauthn_free_decoded_get_assertion_request(
                    self.inner as *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
                );
            }
        }
    }
}

// Windows API function signatures for decoding get assertion requests
// CancelOperation Types
pub struct PluginCancelOperationRequest {
    inner: NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>,
}

impl PluginCancelOperationRequest {
    /// Request transaction ID
    pub fn transaction_id(&self) -> GUID {
        self.as_ref().transactionId
    }

    /// Request signature.
    pub fn request_signature(&self) -> &[u8] {
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

#[doc(hidden)]
impl From<NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>> for PluginCancelOperationRequest {
    fn from(value: NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>) -> Self {
        Self { inner: value }
    }
}
