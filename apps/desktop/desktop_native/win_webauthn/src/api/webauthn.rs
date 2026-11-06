//! Safe wrappers types and functions around raw webauthn.dll functions defined in `webauthn.h`.

#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::{collections::HashSet, marker::PhantomData, ptr::NonNull, time::Duration};

use windows::{
    core::{BOOL, GUID, HRESULT, PCWSTR},
    Win32::Foundation::{ERROR_CANCELLED, HWND, NTE_USER_CANCELLED},
};

use super::{
    sys::{
        webauthn_authenticator_get_assertion, webauthn_cancel_current_operation,
        webauthn_free_assertion, webauthn_get_api_version_number, webauthn_get_cancellation_id,
        webauthn_get_error_name, WEBAUTHN_API_VERSION_4, WEBAUTHN_ASSERTION,
        WEBAUTHN_ASSERTION_VERSION_3, WEBAUTHN_ASSERTION_VERSION_4, WEBAUTHN_ASSERTION_VERSION_6,
        WEBAUTHN_AUTHENTICATOR_ATTACHMENT_ANY, WEBAUTHN_AUTHENTICATOR_ATTACHMENT_CROSS_PLATFORM,
        WEBAUTHN_AUTHENTICATOR_ATTACHMENT_PLATFORM, WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS,
        WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_4,
        WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_6, WEBAUTHN_CLIENT_DATA,
        WEBAUTHN_CLIENT_DATA_CURRENT_VERSION, WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
        WEBAUTHN_COSE_CREDENTIAL_PARAMETERS, WEBAUTHN_CREDENTIAL_EX,
        WEBAUTHN_CREDENTIAL_EX_CURRENT_VERSION, WEBAUTHN_CREDENTIAL_LIST,
        WEBAUTHN_CREDENTIAL_TYPE_PUBLIC_KEY, WEBAUTHN_CRED_WITH_HMAC_SECRET_SALT,
        WEBAUTHN_HASH_ALGORITHM_SHA_256, WEBAUTHN_HMAC_SECRET_SALT,
        WEBAUTHN_HMAC_SECRET_SALT_VALUES, WEBAUTHN_RP_ENTITY_INFORMATION,
        WEBAUTHN_USER_ENTITY_INFORMATION, WEBAUTHN_USER_VERIFICATION_REQUIREMENT_ANY,
        WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED,
        WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
        WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED,
    },
    util::{ArrayPointerIterator, WindowsString},
};
use crate::{api::util::cbor::CborWriter, ErrorKind, WinWebAuthnError};

/// List of its supported protocol versions and extensions, its AAGUID, and
/// other aspects of its overall capabilities.
///
/// Corresponds to the
/// [CTAP2 authenticatorGetInfo response structure][ctap2-getinfo-response]
///
/// [ctap2-getinfo-response]: https://fidoalliance.org/specs/fido-v2.3-rd-20251023/fido-client-to-authenticator-protocol-v2.3-rd-20251023.html#getinfo-authenticatorgetinfo-response-structure
pub struct AuthenticatorInfo {
    /// List of supported versions.
    pub versions: HashSet<CtapVersion>,

    /// The claimed AAGUID. 16 bytes in length and encoded the same as
    /// MakeCredential AuthenticatorData, as specified in [WebAuthn](https://www.w3.org/TR/webauthn-3/#aaguid).
    ///
    /// Note: even though the name has "guid" in it, this is actually an RFC 4122
    /// UUID, which is deserialized differently than a Windows GUID.
    pub aaguid: Uuid,

    /// List of supported options, corresponding to the
    /// [`options` key of the CTAP2 `authenticatorGetInfo` object][ctap2-getinfo-options].
    ///
    /// [ctap2-getinfo-options]: https://fidoalliance.org/specs/fido-v2.3-rd-20251023/fido-client-to-authenticator-protocol-v2.3-rd-20251023.html#option-id
    pub options: Option<HashSet<String>>,

    /// List of supported transports. Values are taken from the
    /// [AuthenticatorTransport enum in WebAuthn][authenticator-transport].
    /// The list MUST NOT include duplicate values nor be empty if present.
    /// Platforms MUST tolerate unknown values.
    ///
    /// [authenticator-transport]: https://www.w3.org/TR/webauthn-3/#enum-transport
    pub transports: Option<HashSet<String>>,

    /// List of supported algorithms for credential generation, as specified in
    /// [WebAuthn][public-key-cred-params]. The array is ordered from most
    /// preferred to least preferred and MUST NOT include duplicate entries nor
    /// be empty if present.
    ///
    /// `PublicKeyCredentialParameters`' algorithm identifiers are values that
    /// SHOULD be registered in the IANA COSE Algorithms registry
    /// [IANA-COSE-ALGS-REG].
    ///
    /// [public-key-cred-params]: https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialparameters
    pub algorithms: Option<Vec<PublicKeyCredentialParameters>>,
}

impl AuthenticatorInfo {
    pub fn as_ctap_bytes(&self) -> Result<Vec<u8>, WinWebAuthnError> {
        self.write_cbor().map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::Serialization,
                "Failed to serialize authenticator info as CBOR",
                err,
            )
        })
    }

    fn write_cbor(&self) -> Result<Vec<u8>, std::io::Error> {
        // Create the authenticator info map according to CTAP2 spec
        // Note that we sort some set fields where order doesn't matter in order
        // to make output stable so we don't have to implement a CBOR reader for
        // the tests.
        let mut authenticator_info = Vec::new();

        let mut writer = CborWriter::new(&mut authenticator_info);

        // calculate map len based on presence of optional fields.
        let mut map_len = 3; // required fields: versions, extensions, AAGUID
        if self.options.is_some() {
            map_len += 1;
        }
        if self.transports.is_some() {
            map_len += 1;
        }
        if self.algorithms.is_some() {
            map_len += 1;
        }
        writer.write_map_start(map_len)?;

        // 1: versions - Array of supported FIDO versions
        writer.write_number(1)?;
        writer.write_array_start(self.versions.len())?;
        let mut versions = self
            .versions
            .iter()
            .map(|v| v.into())
            .collect::<Vec<&str>>();
        versions.sort();
        for v in versions.iter() {
            writer.write_text(v)?;
        }

        // 2: extensions - Array of supported extensions (empty for now)
        writer.write_number(2)?;
        writer.write_array_start(0)?;

        // 3: aaguid - 16-byte AAGUID
        writer.write_number(3)?;
        writer.write_bytes(self.aaguid.0)?;

        // 4: options - Map of supported options
        if let Some(options) = &self.options {
            let mut sorted: Vec<_> = options.iter().collect();
            // Sort by CTAP2 canonical CBOR encoding: major type (all the same),
            // then key length, then lexicographical value.
            sorted.sort_by(|a, b| a.len().cmp(&b.len()).then_with(|| a.cmp(b)));
            writer.write_number(4)?;
            writer.write_map_start(sorted.len())?;
            for o in sorted.iter() {
                writer.write_text(o)?;
                writer.write_bool(true)?;
            }
        }

        // 9: transports - Array of supported transports
        if let Some(transports) = &self.transports {
            writer.write_number(9)?;
            writer.write_array_start(transports.len())?;
            let mut sorted: Vec<_> = transports.iter().collect();
            sorted.sort();
            for t in sorted.iter() {
                writer.write_text(t)?;
            }
        }

        // 10: algorithms - Array of supported algorithms
        if let Some(algorithms) = &self.algorithms {
            writer.write_number(10)?;
            writer.write_array_start(algorithms.len())?;
            for a in algorithms.iter() {
                writer.write_map_start(2)?;
                writer.write_text("alg")?;
                writer.write_number(a.alg.into())?;
                writer.write_text("type")?;
                writer.write_text(&a.typ)?;
            }
        }

        Ok(authenticator_info)
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

        // SAFETY: We already checked the length of the string before, so this should result in the
        // correct number of bytes.
        let b: [u8; 16] = bytes.try_into().expect("16 bytes to be parsed");
        Ok(Uuid(b))
    }
}

#[derive(Hash, Eq, PartialEq)]
pub enum CtapVersion {
    Fido2_0,
    Fido2_1,
    Fido2_3,
}

impl From<&CtapVersion> for &str {
    fn from(value: &CtapVersion) -> Self {
        match value {
            CtapVersion::Fido2_0 => "FIDO_2_0",
            CtapVersion::Fido2_1 => "FIDO_2_1",
            CtapVersion::Fido2_3 => "FIDO_2_3",
        }
    }
}

pub struct PublicKeyCredentialParameters {
    pub alg: i32,
    pub typ: String,
}

/// A wrapper around [WEBAUTHN_RP_ENTITY_INFORMATION].
pub struct RpEntityInformation<'a> {
    ptr: NonNull<WEBAUTHN_RP_ENTITY_INFORMATION>,
    _phantom: PhantomData<&'a WEBAUTHN_RP_ENTITY_INFORMATION>,
}

impl RpEntityInformation<'_> {
    /// # Safety
    /// When calling this method, you must ensure that
    /// - the pointer is convertible to a reference,
    /// - pwszId points to a valid null-terminated UTF-16 string.
    /// - pwszName is null or points to a valid null-terminated UTF-16 string.
    pub(in crate::api) unsafe fn new(ptr: &WEBAUTHN_RP_ENTITY_INFORMATION) -> Self {
        Self {
            ptr: NonNull::from_ref(ptr),
            _phantom: PhantomData,
        }
    }

    /// Identifier for the RP.
    pub fn id(&self) -> String {
        // SAFETY: If the caller upholds the constraints of the struct in
        // Self::new(), then pwszId is valid UTF-16.
        unsafe {
            assert!(self.ptr.is_aligned());
            PCWSTR(self.ptr.as_ref().pwszId.as_ptr())
                .to_string()
                .expect("valid null-terminated UTF-16 string")
        }
    }

    /// Contains the friendly name of the Relying Party, such as "Acme
    /// Corporation", "Widgets Inc" or "Awesome Site".
    pub fn name(&self) -> Option<String> {
        // SAFETY: If the caller upholds the constraints of the struct in
        // Self::new(), then pwszName is either null or valid UTF-16.
        unsafe {
            if self.ptr.as_ref().pwszName.is_null() {
                return None;
            }
            let s = PCWSTR(self.ptr.as_ref().pwszName)
                .to_string()
                .expect("null-terminated UTF-16 string or null");

            // WebAuthn Level 3 deprecates the use of the `name` field, so verify whether this is
            // empty or not.
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        }
    }
}

pub struct UserEntityInformation<'a> {
    ptr: NonNull<WEBAUTHN_USER_ENTITY_INFORMATION>,
    _phantom: PhantomData<&'a WEBAUTHN_USER_ENTITY_INFORMATION>,
}

impl UserEntityInformation<'_> {
    /// # Safety
    /// When calling this method, the caller must ensure that
    /// - `ptr` is convertible to a reference,
    /// - pbId is non-null and points to a valid memory allocation with length of cbId.
    /// - pwszName is non-null and points to a valid null-terminated UTF-16 string.
    /// - pwszDisplayName is non-null and points to a valid null-terminated UTF-16 string.
    pub(in crate::api) unsafe fn new(ptr: &WEBAUTHN_USER_ENTITY_INFORMATION) -> Self {
        Self {
            ptr: NonNull::from_ref(ptr),
            _phantom: PhantomData,
        }
    }

    /// User handle.
    pub fn id(&self) -> &[u8] {
        // SAFETY: If the caller upholds the constraints on Self::new(), then pbId
        // is non-null and points to valid memory.
        unsafe {
            let ptr = self.ptr.as_ref();
            std::slice::from_raw_parts(ptr.pbId.as_ptr(), ptr.cbId.get() as usize)
        }
    }

    /// User name.
    pub fn name(&self) -> String {
        // SAFETY: If the caller upholds the constraints on Self::new(), then ID
        // is non-null and points to valid memory.
        unsafe {
            let ptr = self.ptr.as_ref();
            PCWSTR(ptr.pwszName.as_ptr())
                .to_string()
                .expect("valid UTF-16 string")
        }
    }

    /// User display name.
    pub fn display_name(&self) -> String {
        unsafe {
            let ptr = self.ptr.as_ref();

            PCWSTR(ptr.pwszDisplayName.as_ptr())
                .to_string()
                .expect("valid UTF-16 string")
        }
    }
}

pub struct CoseCredentialParameter<'a> {
    inner: &'a WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
}

impl CoseCredentialParameter<'_> {
    pub fn credential_type(&self) -> Result<String, WinWebAuthnError> {
        let pcwstr = PCWSTR(self.inner.pwszCredentialType.as_ptr());
        // SAFETY: Windows writes valid strings.
        let result = unsafe { pcwstr.to_string() };
        result.map_err(|err| {
            WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "Invalid credential type", err)
        })
    }
    pub fn alg(&self) -> i32 {
        self.inner.lAlg
    }
}

pub struct CoseCredentialParameters<'a> {
    pub(in crate::api) inner: ArrayPointerIterator<'a, WEBAUTHN_COSE_CREDENTIAL_PARAMETER>,
}

impl<'a> Iterator for CoseCredentialParameters<'a> {
    type Item = CoseCredentialParameter<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        self.inner
            .next()
            .map(|p| CoseCredentialParameter { inner: p })
    }
}

impl WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    /// # Safety
    /// The caller must ensure that the pCredentialParameters is either null or
    /// marks the beginning of a list whose count is represented accurately by
    /// cCredentialParameters.
    pub unsafe fn iter(&self) -> ArrayPointerIterator<'_, WEBAUTHN_COSE_CREDENTIAL_PARAMETER> {
        ArrayPointerIterator::new(
            self.pCredentialParameters,
            self.cCredentialParameters as usize,
        )
    }
}

pub struct HmacSecretSalt {
    _first: Vec<u8>,
    _second: Option<Vec<u8>>,
}

// These names follow the naming convention in the Windows API.
#[allow(clippy::enum_variant_names)]
pub enum CredProtectOutput {
    UserVerificationAny,
    UserVerificationOptional,
    UserVerificationOptionalWithCredentialIdList,
    UserVerificationRequired,
}
pub enum WebAuthnExtensionMakeCredentialOutput {
    HmacSecret(bool),
    CredProtect(CredProtectOutput),
    CredBlob(bool),
    MinPinLength(u32),
    // LargeBlob,
}

#[derive(Debug)]
pub struct UserId(Vec<u8>);

impl UserId {
    // User IDs cannot be empty
    #[allow(clippy::len_without_is_empty)]
    pub fn len(&self) -> u8 {
        // SAFETY: User ID guaranteed to be <= 64 bytes
        self.0.len() as u8
    }
}
impl AsRef<[u8]> for UserId {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

impl TryFrom<Vec<u8>> for UserId {
    type Error = WinWebAuthnError;

    fn try_from(value: Vec<u8>) -> Result<Self, Self::Error> {
        if value.is_empty() {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "User ID cannot be empty",
            ));
        }
        if value.len() > 64 {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                &format!(
                    "User ID exceeds maximum length of 64, received {}",
                    value.len()
                ),
            ));
        }
        Ok(UserId(value))
    }
}

#[derive(Debug)]
pub struct CredentialId(Vec<u8>);

impl CredentialId {
    // Credential IDs cannot be empty
    #[allow(clippy::len_without_is_empty)]
    pub fn len(&self) -> u16 {
        // SAFETY: CredentialId guaranteed to be < 1024 bytes
        self.0.len() as u16
    }
}

impl AsRef<[u8]> for CredentialId {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

impl TryFrom<Vec<u8>> for CredentialId {
    type Error = WinWebAuthnError;

    fn try_from(value: Vec<u8>) -> Result<Self, Self::Error> {
        if value.len() < 16 || value.len() > 1023 {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                &format!(
                    "Credential ID must be between 16 and 1023 bytes long, received {}",
                    value.len()
                ),
            ));
        }
        Ok(CredentialId(value))
    }
}

pub struct CredentialEx<'a> {
    inner: &'a WEBAUTHN_CREDENTIAL_EX,
}

impl CredentialEx<'_> {
    pub fn credential_id(&self) -> Option<&[u8]> {
        if self.inner.cbId == 0 || self.inner.pbId.is_null() {
            None
        } else {
            unsafe {
                Some(std::slice::from_raw_parts(
                    self.inner.pbId,
                    self.inner.cbId as usize,
                ))
            }
        }
    }

    pub fn credential_type(&self) -> Result<String, WinWebAuthnError> {
        if self.inner.pwszCredentialType.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid credential type",
            ));
        }
        unsafe {
            PCWSTR(self.inner.pwszCredentialType)
                .to_string()
                .map_err(|err| {
                    WinWebAuthnError::with_cause(
                        ErrorKind::WindowsInternal,
                        "Invalid credential type",
                        err,
                    )
                })
        }
    }

    pub fn transports(&self) -> Vec<CtapTransport> {
        let mut transports = Vec::new();
        let mut t = self.inner.dwTransports;
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
                transports.push(a);
                t -= a as u32;
            }
        }
        transports
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

impl CtapTransport {
    /// Converts a single WEBAUTHN_CTAP_TRANSPORT_* bit. Returns `None` for unknown values or
    /// combinations of bits.
    fn from_bit(bit: u32) -> Option<Self> {
        match bit {
            1 => Some(Self::Usb),
            2 => Some(Self::Nfc),
            4 => Some(Self::Ble),
            8 => Some(Self::Test),
            0x10 => Some(Self::Internal),
            0x20 => Some(Self::Hybrid),
            0x40 => Some(Self::SmartCard),
            _ => None,
        }
    }
}

impl WEBAUTHN_CREDENTIAL_LIST {
    pub(super) unsafe fn iter(&self) -> CredentialListIterator<'_> {
        // SAFETY: This type can only be constructed from this library using
        // responses from Windows APIs. The pointer is checked for null safety
        // on construction.
        unsafe {
            CredentialListIterator {
                inner: ArrayPointerIterator::new(self.ppCredentials, self.cCredentials as usize),
            }
        }
    }
}

pub struct CredentialListIterator<'a> {
    inner: ArrayPointerIterator<'a, *const WEBAUTHN_CREDENTIAL_EX>,
}

impl<'a> Iterator for CredentialListIterator<'a> {
    type Item = CredentialEx<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        let item = self.inner.next()?;
        // SAFETY: This type can only be constructed from this library using
        // responses from Windows APIs, and we trust that the pointer and length
        // of each inner item of the array is valid.
        unsafe { item.as_ref().map(|inner| CredentialEx { inner }) }
    }
}

/// The default timeout for [get_assertion], used when the request does not set one. This is the
/// default recommended by WebAuthn.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(300);

/// Returns the API version of the installed webauthn.dll, which determines the features that
/// are available. Pass this to [GetAssertionRequest::builder].
pub fn api_version() -> Result<u32, WinWebAuthnError> {
    // SAFETY: This function has no preconditions.
    unsafe { webauthn_get_api_version_number() }
}

/// Whether user verification is required for an operation.
///
/// Corresponds to [`UserVerificationRequirement`][uv] in WebAuthn.
///
/// [uv]: https://www.w3.org/TR/webauthn-3/#enumdef-userverificationrequirement
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum UserVerificationRequirement {
    /// Let the platform decide.
    #[default]
    Any,
    Required,
    Preferred,
    Discouraged,
}

impl UserVerificationRequirement {
    fn as_raw(self) -> u32 {
        match self {
            Self::Any => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_ANY,
            Self::Required => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED,
            Self::Preferred => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
            Self::Discouraged => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED,
        }
    }
}

/// Which kinds of authenticators may be used for an operation.
///
/// Corresponds to [`AuthenticatorAttachment`][attachment] in WebAuthn.
///
/// [attachment]: https://www.w3.org/TR/webauthn-3/#enumdef-authenticatorattachment
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum AuthenticatorAttachment {
    /// Any authenticator.
    #[default]
    Any,
    /// Authenticators that are part of the device, like Windows Hello and passkey plugins.
    Platform,
    /// Roaming authenticators, like security keys and phones.
    CrossPlatform,
}

impl AuthenticatorAttachment {
    fn as_raw(self) -> u32 {
        match self {
            Self::Any => WEBAUTHN_AUTHENTICATOR_ATTACHMENT_ANY,
            Self::Platform => WEBAUTHN_AUTHENTICATOR_ATTACHMENT_PLATFORM,
            Self::CrossPlatform => WEBAUTHN_AUTHENTICATOR_ATTACHMENT_CROSS_PLATFORM,
        }
    }
}

/// A credential that may be used for an assertion.
///
/// Corresponds to a [`PublicKeyCredentialDescriptor`][descriptor] in `allowCredentials`.
///
/// [descriptor]: https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialdescriptor
pub struct AllowCredential {
    pub id: CredentialId,
    /// Transports that the client may use to reach the credential. Empty means no restriction.
    pub transports: Vec<CtapTransport>,
}

/// A pair of PRF inputs.
///
/// Corresponds to [`AuthenticationExtensionsPRFValues`][values] in the PRF extension. The values
/// are hashed by webauthn.dll into hmac-secret salts as the extension specifies, so they may be
/// any length.
///
/// [values]: https://www.w3.org/TR/webauthn-3/#dictdef-authenticationextensionsprfvalues
pub struct PrfValues {
    pub first: Vec<u8>,
    pub second: Option<Vec<u8>>,
}

/// Inputs for the PRF extension.
///
/// Corresponds to [`AuthenticationExtensionsPRFInputs`][inputs].
///
/// [inputs]: https://www.w3.org/TR/webauthn-3/#dictdef-authenticationextensionsprfinputs
pub struct PrfInputs {
    /// PRF inputs to use for any credential without an entry in `eval_by_credential`.
    pub eval: Option<PrfValues>,
    /// PRF inputs to use for specific credentials. Each credential must also be in the request's
    /// allow list, or [get_assertion] returns an error.
    pub eval_by_credential: Vec<(CredentialId, PrfValues)>,
}

/// PRF outputs returned by an authenticator.
///
/// Corresponds to [`AuthenticationExtensionsPRFValues`][values] in the PRF extension outputs.
/// These are secrets, and must not be logged.
///
/// [values]: https://www.w3.org/TR/webauthn-3/#dictdef-authenticationextensionsprfvalues
pub struct PrfOutputs<'a> {
    pub first: &'a [u8],
    pub second: Option<&'a [u8]>,
}

/// An identifier that can be used to cancel an in-progress [get_assertion] call from another
/// thread.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CancellationId(GUID);

impl CancellationId {
    /// Generates a new cancellation ID.
    pub fn new() -> Result<Self, WinWebAuthnError> {
        let mut id = GUID::zeroed();
        // SAFETY: `id` is a valid GUID to write to.
        unsafe { webauthn_get_cancellation_id(&mut id)? }
            .ok()
            .map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Failed to generate a cancellation ID",
                    err,
                )
            })?;
        Ok(Self(id))
    }

    /// Cancels the operation that was started with this ID. The cancelled operation returns an
    /// error for which [WinWebAuthnError::is_user_cancelled] is true.
    ///
    /// Returns an error if there is no operation in progress with this ID.
    pub fn cancel(&self) -> Result<(), WinWebAuthnError> {
        // SAFETY: `self.0` is a valid GUID.
        unsafe { webauthn_cancel_current_operation(&self.0)? }
            .ok()
            .map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Failed to cancel the operation",
                    err,
                )
            })
    }
}

/// A request for [get_assertion]. Use [GetAssertionRequest::builder] to create one.
pub struct GetAssertionRequest {
    api_version: u32,
    rp_id: String,
    client_data_json: Vec<u8>,
    timeout: Duration,
    allow_credentials: Vec<AllowCredential>,
    user_verification: UserVerificationRequirement,
    authenticator_attachment: AuthenticatorAttachment,
    cancellation_id: Option<CancellationId>,
    u2f_app_id: Option<String>,
    prf: Option<PrfInputs>,
}

impl GetAssertionRequest {
    /// Starts building a request.
    ///
    /// # Arguments
    /// - `api_version`: The webauthn.dll API version, from [api_version]. Extensions that this
    ///   version does not support are rejected by `require_*` methods and skipped by `prefer_*`
    ///   methods on the builder.
    /// - `rp_id`: The RP ID for the request.
    /// - `client_data_json`: The serialized [client data][client-data]. webauthn.dll hashes it with
    ///   SHA-256 to produce the client data hash that the authenticator signs.
    ///
    /// [client-data]: https://www.w3.org/TR/webauthn-3/#dictdef-collectedclientdata
    pub fn builder(
        api_version: u32,
        rp_id: impl Into<String>,
        client_data_json: Vec<u8>,
    ) -> GetAssertionRequestBuilder {
        GetAssertionRequestBuilder {
            request: GetAssertionRequest {
                api_version,
                rp_id: rp_id.into(),
                client_data_json,
                timeout: DEFAULT_TIMEOUT,
                allow_credentials: Vec::new(),
                user_verification: UserVerificationRequirement::default(),
                authenticator_attachment: AuthenticatorAttachment::default(),
                cancellation_id: None,
                u2f_app_id: None,
                prf: None,
            },
        }
    }

    /// Whether the PRF extension will be sent with this request.
    pub fn has_prf(&self) -> bool {
        self.prf.is_some()
    }
}

/// Builds a [GetAssertionRequest].
///
/// Extensions that need a newer webauthn.dll than the target API version have two setters:
/// `require_*` returns an error if the extension is not supported, and `prefer_*` silently skips
/// it.
pub struct GetAssertionRequestBuilder {
    request: GetAssertionRequest,
}

impl GetAssertionRequestBuilder {
    /// How long the platform should wait for the user. This is guidance, and may be overridden by
    /// the platform.
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.request.timeout = timeout;
        self
    }

    /// Restricts the assertion to these credentials. If empty, any discoverable credential for
    /// the RP may be used.
    pub fn allow_credentials(mut self, credentials: Vec<AllowCredential>) -> Self {
        self.request.allow_credentials = credentials;
        self
    }

    pub fn user_verification(mut self, requirement: UserVerificationRequirement) -> Self {
        self.request.user_verification = requirement;
        self
    }

    pub fn authenticator_attachment(mut self, attachment: AuthenticatorAttachment) -> Self {
        self.request.authenticator_attachment = attachment;
        self
    }

    /// Allows the request to be cancelled from another thread with [CancellationId::cancel].
    pub fn cancellation_id(mut self, id: CancellationId) -> Self {
        self.request.cancellation_id = Some(id);
        self
    }

    /// Allows credentials registered with this U2F app ID to be used, corresponding to the
    /// [`appid` extension][appid]. [Assertion::u2f_app_id_used] reports whether it was used.
    ///
    /// The caller is responsible for checking that the app ID is allowed for the caller's origin.
    ///
    /// [appid]: https://www.w3.org/TR/webauthn-3/#sctn-appid-extension
    pub fn u2f_app_id(mut self, app_id: impl Into<String>) -> Self {
        self.request.u2f_app_id = Some(app_id.into());
        self
    }

    /// Requests PRF outputs, or returns an error if the target API version does not support the
    /// PRF extension.
    pub fn require_prf(mut self, prf: PrfInputs) -> Result<Self, WinWebAuthnError> {
        if !supports_prf(self.request.api_version) {
            return Err(WinWebAuthnError::new(
                ErrorKind::NotSupported,
                &format!(
                    "PRF requires webauthn.dll API version {WEBAUTHN_API_VERSION_4}, but the \
                     current version is {}",
                    self.request.api_version
                ),
            ));
        }
        self.request.prf = Some(prf);
        Ok(self)
    }

    /// Requests PRF outputs if the target API version supports the PRF extension, and otherwise
    /// sends the request without it.
    pub fn prefer_prf(mut self, prf: PrfInputs) -> Self {
        if supports_prf(self.request.api_version) {
            self.request.prf = Some(prf);
        }
        self
    }

    pub fn build(self) -> GetAssertionRequest {
        self.request
    }
}

/// Whether webauthn.dll accepts PRF inputs, which were added in version 6 of
/// `WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS`.
fn supports_prf(api_version: u32) -> bool {
    api_version >= WEBAUTHN_API_VERSION_4
}

/// Requests an assertion from an authenticator.
///
/// Windows shows its passkey dialog, modal to `window`, and this call blocks until the user
/// completes or dismisses it, the timeout expires, or the request is cancelled with the
/// request's [CancellationId]. Do not call this from a thread that must stay responsive.
pub fn get_assertion(
    window: HWND,
    request: &GetAssertionRequest,
) -> Result<Assertion, WinWebAuthnError> {
    validate_prf(request)?;

    // Everything that the raw structs point to is declared as a local in this function, so that
    // nothing moves between taking a pointer to it and the call to webauthn.dll.
    let rp_id = request.rp_id.to_utf16();

    let client_data = WEBAUTHN_CLIENT_DATA {
        dwVersion: WEBAUTHN_CLIENT_DATA_CURRENT_VERSION,
        cbClientDataJSON: len_u32(request.client_data_json.len(), "client data JSON")?,
        pbClientDataJSON: request.client_data_json.as_ptr(),
        pwszHashAlgId: WEBAUTHN_HASH_ALGORITHM_SHA_256.0,
    };

    let credentials = request
        .allow_credentials
        .iter()
        .map(|c| WEBAUTHN_CREDENTIAL_EX {
            dwVersion: WEBAUTHN_CREDENTIAL_EX_CURRENT_VERSION,
            cbId: u32::from(c.id.len()),
            pbId: c.id.as_ref().as_ptr(),
            pwszCredentialType: WEBAUTHN_CREDENTIAL_TYPE_PUBLIC_KEY.0,
            dwTransports: c.transports.iter().fold(0, |bits, t| bits | *t as u32),
        })
        .collect::<Vec<_>>();
    let credential_ptrs = credentials
        .iter()
        .map(std::ptr::from_ref)
        .collect::<Vec<_>>();
    let allow_list = WEBAUTHN_CREDENTIAL_LIST {
        cCredentials: len_u32(credential_ptrs.len(), "allow list")?,
        ppCredentials: credential_ptrs.as_ptr(),
    };

    // webauthn.dll declares the salt buffers as mutable, but only reads them.
    let prf = request.prf.as_ref();
    let global_salt = prf
        .and_then(|prf| prf.eval.as_ref())
        .map(hmac_secret_salt)
        .transpose()?;
    let credential_salts = prf
        .map_or(&[][..], |prf| &prf.eval_by_credential[..])
        .iter()
        .map(|(_, values)| hmac_secret_salt(values))
        .collect::<Result<Vec<_>, _>>()?;
    let credentials_with_salts = prf
        .map_or(&[][..], |prf| &prf.eval_by_credential[..])
        .iter()
        .zip(&credential_salts)
        .map(|((id, _), salt)| WEBAUTHN_CRED_WITH_HMAC_SECRET_SALT {
            cbCredID: u32::from(id.len()),
            pbCredID: id.as_ref().as_ptr().cast_mut(),
            pHmacSecretSalt: std::ptr::from_ref(salt).cast_mut(),
        })
        .collect::<Vec<_>>();
    let salt_values = WEBAUTHN_HMAC_SECRET_SALT_VALUES {
        pGlobalHmacSalt: global_salt
            .as_ref()
            .map_or(std::ptr::null_mut(), |s| std::ptr::from_ref(s).cast_mut()),
        cCredWithHmacSecretSaltList: len_u32(credentials_with_salts.len(), "PRF inputs")?,
        pCredWithHmacSecretSaltList: if credentials_with_salts.is_empty() {
            std::ptr::null_mut()
        } else {
            credentials_with_salts.as_ptr().cast_mut()
        },
    };

    let u2f_app_id = request.u2f_app_id.as_deref().map(str::to_utf16);
    // Set to TRUE by webauthn.dll if the U2F app ID was used instead of the RP ID.
    let mut u2f_app_id_used = BOOL(0);

    // Version 4 has every field except PRF inputs, and is supported by every API version. The
    // request builder only accepts PRF inputs if the API version supports version 6.
    let mut options = WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS::new(if prf.is_some() {
        WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_6
    } else {
        WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_4
    });
    options.dwTimeoutMilliseconds = u32::try_from(request.timeout.as_millis()).unwrap_or(u32::MAX);
    options.dwAuthenticatorAttachment = request.authenticator_attachment.as_raw();
    options.dwUserVerificationRequirement = request.user_verification.as_raw();
    if !credentials.is_empty() {
        options.pAllowCredentialList = &allow_list;
    }
    if let Some(id) = &request.cancellation_id {
        options.pCancellationId = &id.0;
    }
    if let Some(app_id) = &u2f_app_id {
        options.pwszU2fAppId = app_id.as_ptr();
        options.pbU2fAppId = &mut u2f_app_id_used;
    }
    if prf.is_some() {
        options.pHmacSecretSaltValues = &salt_values;
    }

    let mut assertion = std::ptr::null_mut();
    // SAFETY: Every pointer in the arguments points to a local that outlives this call, and the
    // options struct only sets fields of the version it declares.
    let hresult = unsafe {
        webauthn_authenticator_get_assertion(
            window,
            rp_id.as_ptr(),
            &client_data,
            &options,
            &mut assertion,
        )?
    };
    if hresult.is_err() {
        return Err(operation_error(hresult, "Failed to get an assertion"));
    }
    let ptr = NonNull::new(assertion).ok_or_else(|| {
        WinWebAuthnError::new(
            ErrorKind::WindowsInternal,
            "webauthn.dll returned a null assertion",
        )
    })?;
    Ok(Assertion {
        ptr,
        u2f_app_id_used: u2f_app_id.is_some().then(|| u2f_app_id_used.as_bool()),
    })
}

/// Checks that every `eval_by_credential` entry is in the allow list, as required by the
/// [PRF extension's client processing][prf-client].
///
/// [prf-client]: https://www.w3.org/TR/webauthn-3/#prf-extension
fn validate_prf(request: &GetAssertionRequest) -> Result<(), WinWebAuthnError> {
    let Some(prf) = &request.prf else {
        return Ok(());
    };
    if prf.eval_by_credential.is_empty() {
        return Ok(());
    }
    if request.allow_credentials.is_empty() {
        return Err(WinWebAuthnError::new(
            ErrorKind::InvalidArguments,
            "PRF evalByCredential requires an allow list",
        )
        .with_dom_error_name(Some("NotSupportedError".to_string())));
    }
    let all_allowed = prf.eval_by_credential.iter().all(|(id, _)| {
        let credential_is_allowed = request
            .allow_credentials
            .iter()
            .any(|allowed| allowed.id.as_ref() == id.as_ref());
        credential_is_allowed
    });
    if !all_allowed {
        return Err(WinWebAuthnError::new(
            ErrorKind::InvalidArguments,
            "PRF evalByCredential contains a credential that is not in the allow list",
        )
        .with_dom_error_name(Some("SyntaxError".to_string())));
    }
    Ok(())
}

fn hmac_secret_salt(values: &PrfValues) -> Result<WEBAUTHN_HMAC_SECRET_SALT, WinWebAuthnError> {
    let second = values.second.as_deref().unwrap_or_default();
    Ok(WEBAUTHN_HMAC_SECRET_SALT {
        cbFirst: len_u32(values.first.len(), "PRF input")?,
        pbFirst: values.first.as_ptr().cast_mut(),
        cbSecond: len_u32(second.len(), "PRF input")?,
        pbSecond: if second.is_empty() {
            std::ptr::null_mut()
        } else {
            second.as_ptr().cast_mut()
        },
    })
}

fn len_u32(len: usize, what: &str) -> Result<u32, WinWebAuthnError> {
    u32::try_from(len).map_err(|_| {
        WinWebAuthnError::new(ErrorKind::InvalidArguments, &format!("{what} is too long"))
    })
}

/// Converts an HRESULT from a WebAuthn operation into an error, including the corresponding
/// DOMException name.
fn operation_error(hresult: HRESULT, description: &str) -> WinWebAuthnError {
    let kind = if hresult == NTE_USER_CANCELLED || hresult == ERROR_CANCELLED.to_hresult() {
        ErrorKind::UserCancelled
    } else {
        ErrorKind::OperationFailed
    };
    // SAFETY: webauthn.dll returns a static, null-terminated string that must not be freed.
    let dom_error_name = unsafe { webauthn_get_error_name(hresult) }
        .ok()
        .filter(|name| !name.is_null())
        .and_then(|name| unsafe { PCWSTR(name).to_string() }.ok());
    WinWebAuthnError::with_cause(
        kind,
        description,
        windows::core::Error::from_hresult(hresult),
    )
    .with_dom_error_name(dom_error_name)
}

/// An assertion returned by [get_assertion].
///
/// The memory is owned by webauthn.dll and freed when this is dropped.
pub struct Assertion {
    ptr: NonNull<WEBAUTHN_ASSERTION>,
    u2f_app_id_used: Option<bool>,
}

// SAFETY: The assertion is exclusively owned by this struct, is never written to, and can be
// freed from any thread.
unsafe impl Send for Assertion {}
// SAFETY: All access through `&Assertion` is read-only.
unsafe impl Sync for Assertion {}

impl Assertion {
    fn raw(&self) -> RawAssertion<'_> {
        // SAFETY: `ptr` was returned by WebAuthNAuthenticatorGetAssertion, and is valid until
        // `self` is dropped.
        unsafe { RawAssertion::new(self.ptr) }
    }

    /// The ID of the credential that was used.
    pub fn credential_id(&self) -> &[u8] {
        self.raw().credential_id()
    }

    /// The type of the credential that was used, e.g. `"public-key"`.
    pub fn credential_type(&self) -> Result<String, WinWebAuthnError> {
        let ty = self.raw().credential_type();
        if ty.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "webauthn.dll returned a null credential type",
            ));
        }
        // SAFETY: webauthn.dll returns a valid null-terminated string.
        unsafe { PCWSTR(ty).to_string() }.map_err(|err| {
            WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "Invalid credential type", err)
        })
    }

    pub fn authenticator_data(&self) -> &[u8] {
        self.raw().authenticator_data()
    }

    pub fn signature(&self) -> &[u8] {
        self.raw().signature()
    }

    /// The user handle of the credential, if the authenticator returned one.
    pub fn user_handle(&self) -> Option<&[u8]> {
        let id = self.raw().user_id();
        (!id.is_empty()).then_some(id)
    }

    /// PRF outputs, if PRF was requested and the authenticator returned results.
    pub fn prf_results(&self) -> Option<PrfOutputs<'_>> {
        self.raw().prf_results()
    }

    /// The transport that was used to reach the authenticator, if webauthn.dll reports it.
    pub fn used_transport(&self) -> Option<CtapTransport> {
        CtapTransport::from_bit(self.raw().used_transport()?)
    }

    /// The client data JSON that was signed, if webauthn.dll returns it.
    pub fn client_data_json(&self) -> Option<&[u8]> {
        self.raw()
            .client_data_json()
            .filter(|json| !json.is_empty())
    }

    /// Whether the U2F app ID was used instead of the RP ID, if one was set with
    /// [GetAssertionRequestBuilder::u2f_app_id]. This is the `appid` extension output.
    pub fn u2f_app_id_used(&self) -> Option<bool> {
        self.u2f_app_id_used
    }

    /// The JSON serialization of the [`AuthenticationResponseJSON`][response], if webauthn.dll
    /// returns it.
    ///
    /// [response]: https://www.w3.org/TR/webauthn-3/#dictdef-authenticationresponsejson
    pub fn authentication_response_json(&self) -> Option<&[u8]> {
        self.raw()
            .authentication_response_json()
            .filter(|json| !json.is_empty())
    }
}

impl Drop for Assertion {
    fn drop(&mut self) {
        // SAFETY: `ptr` was returned by WebAuthNAuthenticatorGetAssertion and is freed only here.
        if let Err(err) = unsafe { webauthn_free_assertion(self.ptr.as_ptr()) } {
            tracing::error!("Failed to free assertion: {err}");
        }
    }
}

/// Reads a [WEBAUTHN_ASSERTION] returned by webauthn.dll.
///
/// webauthn.dll only allocates the fields of the struct version that it reports in `dwVersion`,
/// which may be older than the Rust definition. So this never creates a reference to the whole
/// struct, and reads fields through raw pointers after checking that their version is allocated.
#[derive(Clone, Copy)]
struct RawAssertion<'a> {
    ptr: NonNull<WEBAUTHN_ASSERTION>,
    _assertion: PhantomData<&'a WEBAUTHN_ASSERTION>,
}

impl<'a> RawAssertion<'a> {
    /// # Safety
    /// `ptr` must point to an assertion whose allocation includes every field of the version in
    /// its `dwVersion`, and whose byte buffers are valid for their lengths, for the lifetime `'a`.
    unsafe fn new(ptr: NonNull<WEBAUTHN_ASSERTION>) -> Self {
        Self {
            ptr,
            _assertion: PhantomData,
        }
    }

    fn version(self) -> u32 {
        // SAFETY: Version 1 fields are always allocated.
        unsafe { (&raw const (*self.ptr.as_ptr()).dwVersion).read() }
    }

    fn authenticator_data(self) -> &'a [u8] {
        let ptr = self.ptr.as_ptr();
        // SAFETY: Version 1 fields are always allocated, and `new`'s caller guarantees that the
        // buffer is valid for its length.
        unsafe {
            bytes(
                (&raw const (*ptr).cbAuthenticatorData).read(),
                (&raw const (*ptr).pbAuthenticatorData).read(),
            )
        }
    }

    fn signature(self) -> &'a [u8] {
        let ptr = self.ptr.as_ptr();
        // SAFETY: See `authenticator_data`.
        unsafe {
            bytes(
                (&raw const (*ptr).cbSignature).read(),
                (&raw const (*ptr).pbSignature).read(),
            )
        }
    }

    fn credential_id(self) -> &'a [u8] {
        let ptr = self.ptr.as_ptr();
        // SAFETY: See `authenticator_data`. `Credential` is a version 1 field, and only its
        // version 1 fields are read.
        unsafe {
            bytes(
                (&raw const (*ptr).Credential.cbId).read(),
                (&raw const (*ptr).Credential.pbId).read(),
            )
        }
    }

    fn credential_type(self) -> *const u16 {
        // SAFETY: See `credential_id`.
        unsafe { (&raw const (*self.ptr.as_ptr()).Credential.pwszCredentialType).read() }
    }

    fn user_id(self) -> &'a [u8] {
        let ptr = self.ptr.as_ptr();
        // SAFETY: See `authenticator_data`.
        unsafe {
            bytes(
                (&raw const (*ptr).cbUserId).read(),
                (&raw const (*ptr).pbUserId).read(),
            )
        }
    }

    fn prf_results(self) -> Option<PrfOutputs<'a>> {
        if self.version() < WEBAUTHN_ASSERTION_VERSION_3 {
            return None;
        }
        // SAFETY: The version check above guarantees that the field is allocated, and
        // webauthn.dll returns either null or a valid pointer.
        let salt = unsafe {
            (&raw const (*self.ptr.as_ptr()).pHmacSecret)
                .read()
                .as_ref()
        }?;
        // SAFETY: webauthn.dll returns buffers that are valid for their lengths.
        let (first, second) = unsafe {
            (
                bytes(salt.cbFirst, salt.pbFirst),
                bytes(salt.cbSecond, salt.pbSecond),
            )
        };
        if first.is_empty() {
            return None;
        }
        Some(PrfOutputs {
            first,
            second: (!second.is_empty()).then_some(second),
        })
    }

    fn used_transport(self) -> Option<u32> {
        if self.version() < WEBAUTHN_ASSERTION_VERSION_4 {
            return None;
        }
        // SAFETY: The version check above guarantees that the field is allocated.
        Some(unsafe { (&raw const (*self.ptr.as_ptr()).dwUsedTransport).read() })
    }

    fn client_data_json(self) -> Option<&'a [u8]> {
        if self.version() < WEBAUTHN_ASSERTION_VERSION_6 {
            return None;
        }
        let ptr = self.ptr.as_ptr();
        // SAFETY: The version check above guarantees that the fields are allocated, and `new`'s
        // caller guarantees that the buffer is valid for its length.
        Some(unsafe {
            bytes(
                (&raw const (*ptr).cbClientDataJSON).read(),
                (&raw const (*ptr).pbClientDataJSON).read(),
            )
        })
    }

    fn authentication_response_json(self) -> Option<&'a [u8]> {
        if self.version() < WEBAUTHN_ASSERTION_VERSION_6 {
            return None;
        }
        let ptr = self.ptr.as_ptr();
        // SAFETY: See `client_data_json`.
        Some(unsafe {
            bytes(
                (&raw const (*ptr).cbAuthenticationResponseJSON).read(),
                (&raw const (*ptr).pbAuthenticationResponseJSON).read(),
            )
        })
    }
}

/// Returns the `len` bytes at `ptr`, or an empty slice if `len` is zero or `ptr` is null.
///
/// # Safety
/// If `len` is not zero and `ptr` is not null, `ptr` must point to `len` bytes that are valid for
/// `'a`.
unsafe fn bytes<'a>(len: u32, ptr: *const u8) -> &'a [u8] {
    if len == 0 || ptr.is_null() {
        return &[];
    }
    // SAFETY: The caller guarantees that `ptr` points to `len` valid bytes.
    unsafe { std::slice::from_raw_parts(ptr, len as usize) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::sys::{WEBAUTHN_CREDENTIAL, WEBAUTHN_EXTENSIONS};

    const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
    #[test]
    fn test_generate_cbor_authenticator_info() {
        let aaguid = Uuid::try_from(AAGUID).unwrap();
        let authenticator_info = AuthenticatorInfo {
            versions: HashSet::from([CtapVersion::Fido2_0, CtapVersion::Fido2_1]),
            aaguid,
            options: Some(HashSet::from([
                "alwaysUv".to_string(),
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

        let expected = &[
            166, 1, 130, 104, 70, 73, 68, 79, 95, 50, 95, 48, 104, 70, 73, 68, 79, 95, 50, 95, 49,
            2, 128, 3, 80, 213, 72, 130, 110, 121, 180, 219, 64, 163, 216, 17, 17, 111, 126, 131,
            73, 4, 164, 98, 114, 107, 245, 98, 117, 112, 245, 98, 117, 118, 245, 104, 97, 108, 119,
            97, 121, 115, 85, 118, 245, 9, 130, 102, 104, 121, 98, 114, 105, 100, 104, 105, 110,
            116, 101, 114, 110, 97, 108, 10, 129, 162, 99, 97, 108, 103, 38, 100, 116, 121, 112,
            101, 106, 112, 117, 98, 108, 105, 99, 45, 107, 101, 121,
        ];
        assert_eq!(expected, cbor_bytes.as_slice());
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

    const API_VERSION_WITHOUT_PRF: u32 = 3;
    const API_VERSION_WITH_PRF: u32 = 4;

    fn prf_inputs() -> PrfInputs {
        PrfInputs {
            eval: Some(PrfValues {
                first: b"first".to_vec(),
                second: None,
            }),
            eval_by_credential: Vec::new(),
        }
    }

    #[test]
    fn test_require_prf_errors_when_unsupported() {
        let result = GetAssertionRequest::builder(API_VERSION_WITHOUT_PRF, "example.com", vec![])
            .require_prf(prf_inputs());
        let Err(err) = result else {
            panic!("expected an error");
        };
        assert!(matches!(err.kind, ErrorKind::NotSupported), "{err}");
    }

    #[test]
    fn test_require_prf_succeeds_when_supported() {
        let request = GetAssertionRequest::builder(API_VERSION_WITH_PRF, "example.com", vec![])
            .require_prf(prf_inputs())
            .unwrap()
            .build();
        assert!(request.has_prf());
    }

    #[test]
    fn test_prefer_prf_is_skipped_when_unsupported() {
        let request = GetAssertionRequest::builder(API_VERSION_WITHOUT_PRF, "example.com", vec![])
            .prefer_prf(prf_inputs())
            .build();
        assert!(!request.has_prf());
    }

    #[test]
    fn test_prefer_prf_is_kept_when_supported() {
        let request = GetAssertionRequest::builder(API_VERSION_WITH_PRF, "example.com", vec![])
            .prefer_prf(prf_inputs())
            .build();
        assert!(request.has_prf());
    }

    #[test]
    fn test_ctap_transport_from_bit_rejects_combinations() {
        assert!(matches!(
            CtapTransport::from_bit(0x20),
            Some(CtapTransport::Hybrid)
        ));
        assert!(CtapTransport::from_bit(0x30).is_none());
        assert!(CtapTransport::from_bit(0).is_none());
    }

    #[test]
    fn test_hmac_secret_salt_omits_empty_second() {
        let values = PrfValues {
            first: vec![1, 2, 3],
            second: None,
        };
        let salt = hmac_secret_salt(&values).unwrap();
        assert_eq!(salt.cbFirst, 3);
        assert_eq!(salt.pbFirst.cast_const(), values.first.as_ptr());
        assert_eq!(salt.cbSecond, 0);
        assert!(salt.pbSecond.is_null());
    }

    fn credential_id(byte: u8) -> CredentialId {
        CredentialId::try_from(vec![byte; 16]).unwrap()
    }

    fn prf_for(ids: &[u8]) -> PrfInputs {
        PrfInputs {
            eval: None,
            eval_by_credential: ids
                .iter()
                .map(|b| {
                    (
                        credential_id(*b),
                        PrfValues {
                            first: b"first".to_vec(),
                            second: None,
                        },
                    )
                })
                .collect(),
        }
    }

    fn allow(ids: &[u8]) -> Vec<AllowCredential> {
        ids.iter()
            .map(|b| AllowCredential {
                id: credential_id(*b),
                transports: Vec::new(),
            })
            .collect()
    }

    #[test]
    fn test_validate_prf_accepts_eval_by_credential_in_allow_list() {
        let request = GetAssertionRequest::builder(API_VERSION_WITH_PRF, "example.com", vec![])
            .allow_credentials(allow(&[1, 2]))
            .require_prf(prf_for(&[2]))
            .unwrap()
            .build();
        assert!(validate_prf(&request).is_ok());
    }

    #[test]
    fn test_validate_prf_rejects_eval_by_credential_not_in_allow_list() {
        let request = GetAssertionRequest::builder(API_VERSION_WITH_PRF, "example.com", vec![])
            .allow_credentials(allow(&[1, 2]))
            .require_prf(prf_for(&[2, 3]))
            .unwrap()
            .build();
        let err = validate_prf(&request).unwrap_err();
        assert_eq!(err.dom_error_name(), Some("SyntaxError"));
    }

    #[test]
    fn test_validate_prf_rejects_eval_by_credential_without_allow_list() {
        let request = GetAssertionRequest::builder(API_VERSION_WITH_PRF, "example.com", vec![])
            .require_prf(prf_for(&[1]))
            .unwrap()
            .build();
        let err = validate_prf(&request).unwrap_err();
        assert_eq!(err.dom_error_name(), Some("NotSupportedError"));
    }

    #[test]
    fn test_validate_prf_allows_eval_without_allow_list() {
        let request = GetAssertionRequest::builder(API_VERSION_WITH_PRF, "example.com", vec![])
            .require_prf(prf_inputs())
            .unwrap()
            .build();
        assert!(validate_prf(&request).is_ok());
    }

    /// Returns an assertion whose later fields are all populated, so that a reader only returns
    /// `None` because of `dwVersion`.
    fn assertion(
        version: u32,
        data: &[u8],
        hmac_secret: &WEBAUTHN_HMAC_SECRET_SALT,
    ) -> WEBAUTHN_ASSERTION {
        WEBAUTHN_ASSERTION {
            dwVersion: version,
            cbAuthenticatorData: data.len() as u32,
            pbAuthenticatorData: data.as_ptr(),
            cbSignature: 0,
            pbSignature: std::ptr::null(),
            Credential: WEBAUTHN_CREDENTIAL {
                dwVersion: 1,
                cbId: data.len() as u32,
                pbId: data.as_ptr(),
                pwszCredentialType: std::ptr::null(),
            },
            cbUserId: 0,
            pbUserId: std::ptr::null(),
            Extensions: WEBAUTHN_EXTENSIONS {
                cExtensions: 0,
                pExtensions: std::ptr::null(),
            },
            cbCredLargeBlob: 0,
            pbCredLargeBlob: std::ptr::null(),
            dwCredLargeBlobStatus: 0,
            pHmacSecret: hmac_secret,
            dwUsedTransport: 0x10,
            cbUnsignedExtensionOutputs: 0,
            pbUnsignedExtensionOutputs: std::ptr::null(),
            cbClientDataJSON: data.len() as u32,
            pbClientDataJSON: data.as_ptr(),
            cbAuthenticationResponseJSON: 0,
            pbAuthenticationResponseJSON: std::ptr::null(),
        }
    }

    fn hmac_secret(first: &mut [u8]) -> WEBAUTHN_HMAC_SECRET_SALT {
        WEBAUTHN_HMAC_SECRET_SALT {
            cbFirst: first.len() as u32,
            pbFirst: first.as_mut_ptr(),
            cbSecond: 0,
            pbSecond: std::ptr::null_mut(),
        }
    }

    #[test]
    fn test_raw_assertion_hides_fields_newer_than_version() {
        let data = [1u8, 2, 3];
        let mut first = [7u8; 32];
        let salt = hmac_secret(&mut first);
        let raw = assertion(2, &data, &salt);
        // SAFETY: `raw` is a fully allocated WEBAUTHN_ASSERTION.
        let reader = unsafe { RawAssertion::new(NonNull::from(&raw)) };

        assert_eq!(reader.version(), 2);
        assert_eq!(reader.authenticator_data(), &data);
        assert_eq!(reader.signature(), &[] as &[u8]);
        assert_eq!(reader.credential_id(), &data);
        assert!(reader.prf_results().is_none());
        assert!(reader.used_transport().is_none());
        assert!(reader.client_data_json().is_none());
        assert!(reader.authentication_response_json().is_none());
    }

    #[test]
    fn test_raw_assertion_reads_current_version() {
        let data = [1u8, 2, 3];
        let mut first = [7u8; 32];
        let salt = hmac_secret(&mut first);
        let raw = assertion(6, &data, &salt);
        // SAFETY: `raw` is a fully allocated WEBAUTHN_ASSERTION.
        let reader = unsafe { RawAssertion::new(NonNull::from(&raw)) };

        let prf = reader.prf_results().unwrap();
        assert_eq!(prf.first, &[7u8; 32]);
        assert!(prf.second.is_none());
        assert_eq!(reader.used_transport(), Some(0x10));
        assert_eq!(reader.client_data_json(), Some(&data[..]));
        assert_eq!(reader.authentication_response_json(), Some(&[] as &[u8]));
    }

    #[test]
    fn test_raw_assertion_does_not_read_past_version_1_allocation() {
        let data = [1u8, 2, 3];
        let salt = hmac_secret(&mut []);
        let full = assertion(1, &data, &salt);
        // Copy only the version 1 prefix into an allocation that is too small for the whole
        // struct, as an old webauthn.dll would return.
        let v1_len = std::mem::offset_of!(WEBAUTHN_ASSERTION, Extensions);
        let layout =
            std::alloc::Layout::from_size_align(v1_len, align_of::<WEBAUTHN_ASSERTION>()).unwrap();
        // SAFETY: The layout has a non-zero size, and the copy is within both allocations.
        unsafe {
            let ptr = std::alloc::alloc(layout);
            std::ptr::copy_nonoverlapping((&raw const full).cast::<u8>(), ptr, v1_len);
            let reader = RawAssertion::new(NonNull::new(ptr.cast()).unwrap());
            assert_eq!(reader.authenticator_data(), &data);
            assert!(reader.prf_results().is_none());
            assert!(reader.client_data_json().is_none());
            std::alloc::dealloc(ptr, layout);
        }
    }
}
