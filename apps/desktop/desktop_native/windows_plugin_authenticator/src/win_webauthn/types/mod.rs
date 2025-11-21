//! Types and functions defined in the Windows WebAuthn API.
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
    // com::ComBuffer,
    util::{ArrayPointerIterator, WindowsString},
    ErrorKind,
    WinWebAuthnError,
};

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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_RP_ENTITY_INFORMATION {
    dwVersion: u32,
    pwszId: *const u16,   // PCWSTR
    pwszName: *const u16, // PCWSTR
    pwszIcon: *const u16, // PCWSTR
}

impl WEBAUTHN_RP_ENTITY_INFORMATION {
    /// Relying party ID.
    pub fn id(&self) -> Result<String, WinWebAuthnError> {
        if self.pwszId.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid RP ID",
            ));
        }
        unsafe {
            PCWSTR(self.pwszId).to_string().map_err(|err| {
                WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "Invalid RP ID", err)
            })
        }
    }

    /// Relying party name.
    pub fn name(&self) -> Result<String, WinWebAuthnError> {
        if self.pwszName.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid RP name",
            ));
        }
        unsafe {
            PCWSTR(self.pwszName).to_string().map_err(|err| {
                WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "Invalid RP name", err)
            })
        }
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_USER_ENTITY_INFORMATION {
    pub dwVersion: u32,
    pub cbId: u32,                   // DWORD
    pub pbId: *const u8,             // PBYTE
    pub pwszName: *const u16,        // PCWSTR
    pub pwszIcon: *const u16,        // PCWSTR
    pub pwszDisplayName: *const u16, // PCWSTR
}

impl WEBAUTHN_USER_ENTITY_INFORMATION {
    /// User handle.
    pub fn id(&self) -> Result<&[u8], WinWebAuthnError> {
        if self.cbId == 0 || self.pbId.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid user ID",
            ));
        }
        unsafe { Ok(std::slice::from_raw_parts(self.pbId, self.cbId as usize)) }
    }

    /// User name.
    pub fn name(&self) -> Result<String, WinWebAuthnError> {
        if self.pwszName.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid user name",
            ));
        }
        unsafe {
            PCWSTR(self.pwszName).to_string().map_err(|err| {
                WinWebAuthnError::with_cause(ErrorKind::WindowsInternal, "Invalid user name", err)
            })
        }
    }

    /// User display name.
    pub fn display_name(&self) -> Result<String, WinWebAuthnError> {
        if self.pwszDisplayName.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received invalid user name",
            ));
        }
        unsafe {
            PCWSTR(self.pwszDisplayName).to_string().map_err(|err| {
                WinWebAuthnError::with_cause(
                    ErrorKind::WindowsInternal,
                    "Invalid user display name",
                    err,
                )
            })
        }
    }
}
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    pub dwVersion: u32,
    pub pwszCredentialType: *const u16, // LPCWSTR
    pub lAlg: i32,                      // LONG - COSE algorithm identifier
}

impl WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    pub fn credential_type(&self) -> Result<String, WinWebAuthnError> {
        if self.pwszCredentialType.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Invalid credential type",
            ));
        }
        unsafe {
            PCWSTR(self.pwszCredentialType).to_string().map_err(|err| {
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
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    cCredentialParameters: u32,
    pCredentialParameters: *const WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
}

impl WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    pub fn iter(&self) -> ArrayPointerIterator<'_, WEBAUTHN_COSE_CREDENTIAL_PARAMETER> {
        unsafe {
            ArrayPointerIterator::new(
                self.pCredentialParameters,
                self.cCredentialParameters as usize,
            )
        }
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
    //
    /// Since VERSION 2
    pub(crate) Extensions: WEBAUTHN_EXTENSIONS,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_3
    //
    /// One of the WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transport that was used.
    pub(crate) dwUsedTransport: u32,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_4
    //
    pub(crate) bEpAtt: bool,
    pub(crate) bLargeBlobSupported: bool,
    pub(crate) bResidentKey: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_5
    //
    pub(crate) bPrfEnabled: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_6
    //
    pub(crate) cbUnsignedExtensionOutputs: u32,
    // _Field_size_bytes_(cbUnsignedExtensionOutputs)
    pub(crate) pbUnsignedExtensionOutputs: *const u8,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_7
    //
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
    /*
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
    */
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

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct CredentialList {
    pub cCredentials: u32,
    pub ppCredentials: *const *const WEBAUTHN_CREDENTIAL_EX,
}

pub(crate) type WEBAUTHN_CREDENTIAL_LIST = CredentialList;
pub struct CredentialListIterator<'a> {
    inner: ArrayPointerIterator<'a, *const WEBAUTHN_CREDENTIAL_EX>,
}

impl<'a> Iterator for CredentialListIterator<'a> {
    type Item = &'a WEBAUTHN_CREDENTIAL_EX;

    fn next(&mut self) -> Option<Self::Item> {
        let item = self.inner.next()?;
        // SAFETY: This type can only be constructed from this library using
        // responses from Windows APIs, and we trust that the pointer and length
        // of each inner item of the array is valid.
        unsafe { item.as_ref() }
    }
}

impl CredentialList {
    pub fn iter(&self) -> CredentialListIterator<'_> {
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
