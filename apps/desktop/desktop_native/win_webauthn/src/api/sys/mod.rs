//! Raw types for the Windows webauthn.dll library.
//! The top-level crate includes types defined in webauthn.h.
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

pub(super) mod plugin;
mod util;

use std::{num::NonZeroU32, ptr::NonNull};

use windows::core::BOOL;

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    /// Version of this structure, to allow for modifications in the future.
    pub(super) dwVersion: u32,
    /// Well-known credential type specifying a credential to create.
    pub(super) pwszCredentialType: NonNull<u16>,
    /// Well-known COSE algorithm specifying the algorithm to use for the credential.
    pub(super) lAlg: i32,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    pub(super) cCredentialParameters: u32,
    pub(super) pCredentialParameters: *const WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_CREDENTIAL_ATTESTATION {
    /// Version of this structure, to allow for modifications in the future.
    pub(super) dwVersion: u32,

    /// Attestation format type
    pub(super) pwszFormatType: *const u16, // PCWSTR

    /// Size of cbAuthenticatorData.
    pub(super) cbAuthenticatorData: u32,
    /// Authenticator data that was created for this credential.
    //_Field_size_bytes_(cbAuthenticatorData)
    pub(super) pbAuthenticatorData: *const u8,

    /// Size of CBOR encoded attestation information
    /// 0 => encoded as CBOR null value.
    pub(super) cbAttestation: u32,
    ///Encoded CBOR attestation information
    // _Field_size_bytes_(cbAttestation)
    pub(super) pbAttestation: *const u8,

    pub(super) dwAttestationDecodeType: u32,
    /// Following depends on the dwAttestationDecodeType
    ///  WEBAUTHN_ATTESTATION_DECODE_NONE
    ///      NULL - not able to decode the CBOR attestation information
    ///  WEBAUTHN_ATTESTATION_DECODE_COMMON
    ///      PWEBAUTHN_COMMON_ATTESTATION;
    pub(super) pvAttestationDecode: *const u8,

    /// The CBOR encoded Attestation Object to be returned to the RP.
    pub(super) cbAttestationObject: u32,
    // _Field_size_bytes_(cbAttestationObject)
    pub(super) pbAttestationObject: *const u8,

    /// The CredentialId bytes extracted from the Authenticator Data.
    /// Used by Edge to return to the RP.
    pub(super) cbCredentialId: u32,
    // _Field_size_bytes_(cbCredentialId)
    pub(super) pbCredentialId: *const u8,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_2
    /// Since VERSION 2
    pub(super) Extensions: WEBAUTHN_EXTENSIONS,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_3
    /// One of the WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transport that was used.
    pub(super) dwUsedTransport: u32,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_4
    pub(super) bEpAtt: BOOL,
    pub(super) bLargeBlobSupported: BOOL,
    pub(super) bResidentKey: BOOL,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_5
    pub(super) bPrfEnabled: BOOL,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_6
    pub(super) cbUnsignedExtensionOutputs: u32,
    // _Field_size_bytes_(cbUnsignedExtensionOutputs)
    pub(super) pbUnsignedExtensionOutputs: *const u8,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_7
    pub(super) pHmacSecret: *const WEBAUTHN_HMAC_SECRET_SALT,

    /// ThirdPartyPayment Credential or not.
    pub(super) bThirdPartyPayment: BOOL,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8
    /// Multiple WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transports that are supported.
    pub(super) dwTransports: u32,

    /// UTF-8 encoded JSON serialization of the client data.
    pub(super) cbClientDataJSON: u32,
    // _Field_size_bytes_(cbClientDataJSON)
    pub(super) pbClientDataJSON: *const u8,

    /// UTF-8 encoded JSON serialization of the RegistrationResponse.
    pub(super) cbRegistrationResponseJSON: u32,
    // _Field_size_bytes_(cbRegistrationResponseJSON)
    pub(super) pbRegistrationResponseJSON: *const u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_CREDENTIAL_EX {
    /// Version of this structure, to allow for modifications in the future.
    pub(super) dwVersion: u32,
    /// Size of pbID.
    pub(super) cbId: u32,
    /// Unique ID for this particular credential.
    pub(super) pbId: *const u8,
    /// Well-known credential type specifying what this particular credential is.
    pub(super) pwszCredentialType: *const u16,
    /// Transports. 0 implies no transport restrictions.
    pub(super) dwTransports: u32,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_CREDENTIAL_LIST {
    pub(super) cCredentials: u32,
    pub(super) ppCredentials: *const *const WEBAUTHN_CREDENTIAL_EX,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_EXTENSION {
    pwszExtensionIdentifier: *const u16,
    cbExtension: u32,
    pvExtension: *mut u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_EXTENSIONS {
    pub(super) cExtensions: u32,
    // _Field_size_(cExtensions)
    pub(super) pExtensions: *const WEBAUTHN_EXTENSION,
}

#[repr(C)]
pub(super) struct WEBAUTHN_HMAC_SECRET_SALT {
    /// Size of pbFirst.
    _cbFirst: u32,
    // _Field_size_bytes_(cbFirst)
    /// Required
    _pbFirst: *mut u8,

    /// Size of pbSecond.
    _cbSecond: u32,
    // _Field_size_bytes_(cbSecond)
    _pbSecond: *mut u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_RP_ENTITY_INFORMATION {
    /// Version of this structure, to allow for modifications in the future.
    /// This field is required and should be set to CURRENT_VERSION above.
    pub(super) dwVersion: u32,

    /// Identifier for the RP. This field is required.
    pub(super) pwszId: NonNull<u16>, // PCWSTR

    /// Contains the friendly name of the Relying Party, such as "Acme
    /// Corporation", "Widgets Inc" or "Awesome Site".
    ///
    /// This member is deprecated in WebAuthn Level 3 because many clients do not display it, but
    /// it remains a required dictionary member for backwards compatibility. Relying
    /// Parties MAY, as a safe default, set this equal to the RP ID.
    pub(super) pwszName: *const u16, // PCWSTR

    /// Optional URL pointing to RP's logo.
    ///
    /// This field was removed in WebAuthn Level 2. Keeping this here for proper struct sizing.
    #[deprecated]
    _pwszIcon: *const u16, // PCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_USER_ENTITY_INFORMATION {
    /// Version of this structure, to allow for modifications in the future.
    /// This field is required and should be set to CURRENT_VERSION above.
    pub(super) dwVersion: u32,

    /// Identifier for the User. This field is required.
    pub(super) cbId: NonZeroU32, // DWORD
    pub(super) pbId: NonNull<u8>, // PBYTE

    /// Contains a detailed name for this account, such as "john.p.smith@example.com".
    pub(super) pwszName: NonNull<u16>, // PCWSTR

    /// Optional URL that can be used to retrieve an image containing the user's current avatar,
    /// or a data URI that contains the image data.
    #[deprecated]
    pub(super) pwszIcon: Option<NonNull<u16>>, // PCWSTR

    /// Contains the friendly name associated with the user account by the Relying Party, such as
    /// "John P. Smith".
    pub(super) pwszDisplayName: NonNull<u16>, // PCWSTR
}
