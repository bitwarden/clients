//! Types and functions defined in the Windows WebAuthn API.

#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

pub mod plugin;
mod util;

use std::{collections::HashSet, marker::PhantomData, ptr::NonNull};

use ciborium::Value;
use windows::core::PCWSTR;

use crate::{
    webauthn_sys::{
        WEBAUTHN_COSE_CREDENTIAL_PARAMETER, WEBAUTHN_COSE_CREDENTIAL_PARAMETERS,
        WEBAUTHN_CREDENTIAL_EX, WEBAUTHN_CREDENTIAL_LIST, WEBAUTHN_EXTENSION,
        WEBAUTHN_RP_ENTITY_INFORMATION, WEBAUTHN_USER_ENTITY_INFORMATION,
    },
    ErrorKind, WinWebAuthnError,
};

use util::ArrayPointerIterator;

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

pub struct CoseCredentialParameter {
    inner: NonNull<WEBAUTHN_COSE_CREDENTIAL_PARAMETER>,
}

impl CoseCredentialParameter {
    pub fn credential_type(&self) -> Result<String, WinWebAuthnError> {
        unsafe {
            PCWSTR(self.inner.as_ref().pwszCredentialType.as_ptr())
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
        unsafe { self.inner.as_ref().lAlg }
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

impl WEBAUTHN_CREDENTIAL_LIST {
    unsafe fn iter(&self) -> CredentialListIterator<'_> {
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
            aaguid,
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
