//! Types and functions defined in the Windows WebAuthn API.

#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::{collections::HashSet, fmt::Display, marker::PhantomData, num::NonZeroU32, ptr::NonNull};

use ciborium::Value;
use windows_core::PCWSTR;

use crate::{util::ArrayPointerIterator, ErrorKind, WinWebAuthnError};

/// List of its supported protocol versions and extensions, its AAGUID, and
/// other aspects of its overall capabilities.
pub struct AuthenticatorInfo {
    /// List of supported versions.
    pub versions: HashSet<CtapVersion>,

    /// The claimed AAGUID. 16 bytes in length and encoded the same as
    /// MakeCredential AuthenticatorData, as specified in [WebAuthn](https://www.w3.org/TR/webauthn-3/#aaguid).
    ///
    /// Note: even though the name has "guid" in it, this is actually an RFC 4122
    /// UUID, which is deserialized differently than a Windows GUID.
    pub aaguid: Uuid,

    /// List of supported options.
    pub options: Option<HashSet<String>>,

    /// List of supported transports. Values are taken from the
    /// [AuthenticatorTransport enum in WebAuthn][authenticator-transport].
    /// The list MUST NOT include duplicate values nor be empty if present.
    /// Platforms MUST tolerate unknown values.
    /// [authenticator-transport]: https://www.w3.org/TR/webauthn-3/#enum-transport
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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_RP_ENTITY_INFORMATION {
    /// Version of this structure, to allow for modifications in the future.
    /// This field is required and should be set to CURRENT_VERSION above.
    dwVersion: u32,

    /// Identifier for the RP. This field is required.
    pwszId: NonNull<u16>, // PCWSTR

    /// Contains the friendly name of the Relying Party, such as "Acme
    /// Corporation", "Widgets Inc" or "Awesome Site".
    ///
    /// This member is deprecated in WebAuthn Level 3 because many clients do not display it, but
    /// it remains a required dictionary member for backwards compatibility. Relying
    /// Parties MAY, as a safe default, set this equal to the RP ID.
    pwszName: *const u16, // PCWSTR

    /// Optional URL pointing to RP's logo.
    ///
    /// This field was removed in WebAuthn Level 2. Keeping this here for proper struct sizing.
    #[deprecated]
    _pwszIcon: *const u16, // PCWSTR
}

/// A wrapper around WEBAUTHN_RP_ENTITY_INFORMATION.
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
    pub(crate) unsafe fn new(ptr: &WEBAUTHN_RP_ENTITY_INFORMATION) -> Self {
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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_USER_ENTITY_INFORMATION {
    /// Version of this structure, to allow for modifications in the future.
    /// This field is required and should be set to CURRENT_VERSION above.
    pub dwVersion: u32,

    /// Identifier for the User. This field is required.
    pub cbId: NonZeroU32, // DWORD
    pub pbId: NonNull<u8>, // PBYTE

    /// Contains a detailed name for this account, such as "john.p.smith@example.com".
    pub pwszName: NonNull<u16>, // PCWSTR

    /// Optional URL that can be used to retrieve an image containing the user's current avatar,
    /// or a data URI that contains the image data.
    #[deprecated]
    pub pwszIcon: Option<NonNull<u16>>, // PCWSTR

    /// Contains the friendly name associated with the user account by the Relying Party, such as
    /// "John P. Smith".
    pub pwszDisplayName: NonNull<u16>, // PCWSTR
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
    pub(crate) unsafe fn new(ptr: &WEBAUTHN_USER_ENTITY_INFORMATION) -> Self {
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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    dwVersion: u32,
    pwszCredentialType: NonNull<u16>, // LPCWSTR
    lAlg: i32,                        // LONG - COSE algorithm identifier
}

impl WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    pub fn credential_type(&self) -> Result<String, WinWebAuthnError> {
        unsafe {
            PCWSTR(self.pwszCredentialType.as_ptr())
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
    pub fn alg(&self) -> i32 {
        self.lAlg
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    cCredentialParameters: u32,
    pCredentialParameters: *const WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_CREDENTIAL_ATTESTATION {
    /// Version of this structure, to allow for modifications in the future.
    pub(crate) dwVersion: u32,

    /// Attestation format type
    pub(crate) pwszFormatType: *const u16, // PCWSTR

    /// Size of cbAuthenticatorData.
    pub(crate) cbAuthenticatorData: u32,
    /// Authenticator data that was created for this credential.
    //_Field_size_bytes_(cbAuthenticatorData)
    pub(crate) pbAuthenticatorData: *const u8,

    /// Size of CBOR encoded attestation information
    /// 0 => encoded as CBOR null value.
    pub(crate) cbAttestation: u32,
    ///Encoded CBOR attestation information
    // _Field_size_bytes_(cbAttestation)
    pub(crate) pbAttestation: *const u8,

    pub(crate) dwAttestationDecodeType: u32,
    /// Following depends on the dwAttestationDecodeType
    ///  WEBAUTHN_ATTESTATION_DECODE_NONE
    ///      NULL - not able to decode the CBOR attestation information
    ///  WEBAUTHN_ATTESTATION_DECODE_COMMON
    ///      PWEBAUTHN_COMMON_ATTESTATION;
    pub(crate) pvAttestationDecode: *const u8,

    /// The CBOR encoded Attestation Object to be returned to the RP.
    pub(crate) cbAttestationObject: u32,
    // _Field_size_bytes_(cbAttestationObject)
    pub(crate) pbAttestationObject: *const u8,

    /// The CredentialId bytes extracted from the Authenticator Data.
    /// Used by Edge to return to the RP.
    pub(crate) cbCredentialId: u32,
    // _Field_size_bytes_(cbCredentialId)
    pub(crate) pbCredentialId: *const u8,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_2
    /// Since VERSION 2
    pub(crate) Extensions: WEBAUTHN_EXTENSIONS,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_3
    /// One of the WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transport that was used.
    pub(crate) dwUsedTransport: u32,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_4
    pub(crate) bEpAtt: bool,
    pub(crate) bLargeBlobSupported: bool,
    pub(crate) bResidentKey: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_5
    pub(crate) bPrfEnabled: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_6
    pub(crate) cbUnsignedExtensionOutputs: u32,
    // _Field_size_bytes_(cbUnsignedExtensionOutputs)
    pub(crate) pbUnsignedExtensionOutputs: *const u8,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_7
    pub(crate) pHmacSecret: *const WEBAUTHN_HMAC_SECRET_SALT,

    // ThirdPartyPayment Credential or not.
    pub(crate) bThirdPartyPayment: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8
    //

    // Multiple WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    // the transports that are supported.
    pub(crate) dwTransports: u32,

    // UTF-8 encoded JSON serialization of the client data.
    pub(crate) cbClientDataJSON: u32,
    // _Field_size_bytes_(cbClientDataJSON)
    pub(crate) pbClientDataJSON: *const u8,

    // UTF-8 encoded JSON serialization of the RegistrationResponse.
    pub(crate) cbRegistrationResponseJSON: u32,
    // _Field_size_bytes_(cbRegistrationResponseJSON)
    pub(crate) pbRegistrationResponseJSON: *const u8,
}

pub enum AttestationFormat {
    Packed,
    Tpm,
    AndroidKey,
    FidoU2f,
    None,
    Compound,
    Apple,
}

impl Display for AttestationFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Packed => "packed",
            Self::Tpm => "tpm",
            Self::AndroidKey => "android-key",
            Self::FidoU2f => "fido-u2f",
            Self::None => "none",
            Self::Compound => "compound",
            Self::Apple => "apple",
        })
    }
}

pub enum AttestationDecodeType {
    None,
    Common(),
}

pub(crate) struct WEBAUTHN_HMAC_SECRET_SALT {
    /// Size of pbFirst.
    cbFirst: u32,
    // _Field_size_bytes_(cbFirst)
    /// Required
    pbFirst: *mut u8,

    /// Size of pbSecond.
    cbSecond: u32,
    // _Field_size_bytes_(cbSecond)
    pbSecond: *mut u8,
}

pub struct HmacSecretSalt {
    first: Vec<u8>,
    second: Option<Vec<u8>>,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_EXTENSION {
    pwszExtensionIdentifier: *const u16,
    cbExtension: u32,
    pvExtension: *mut u8,
}

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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_EXTENSIONS {
    pub(crate) cExtensions: u32,
    // _Field_size_(cExtensions)
    pub(crate) pExtensions: *const WEBAUTHN_EXTENSION,
}

#[derive(Debug)]
pub struct UserId(Vec<u8>);

impl UserId {
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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_CREDENTIAL_EX {
    dwVersion: u32,
    cbId: u32,
    pbId: *const u8,
    pwszCredentialType: *const u16, // LPCWSTR
    dwTransports: u32,
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
                "Received invalid credential ID",
            ));
        }
        unsafe {
            PCWSTR(self.inner.pwszCredentialType)
                .to_string()
                .map_err(|err| {
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
                transports.push(a.clone());
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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_CREDENTIAL_LIST {
    pub cCredentials: u32,
    pub ppCredentials: *const *const WEBAUTHN_CREDENTIAL_EX,
}

impl WEBAUTHN_CREDENTIAL_LIST {
    pub unsafe fn iter(&self) -> CredentialListIterator<'_> {
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
