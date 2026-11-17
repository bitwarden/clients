//! Raw types for the Windows webauthn.dll library.
//! The top-level crate includes types defined in webauthn.h.
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

pub(super) mod plugin;
mod util;

use std::{ffi::c_void, num::NonZeroU32, ptr::NonNull};

use windows::{
    core::{w, BOOL, GUID, HRESULT, PCWSTR},
    Win32::Foundation::HWND,
};

use self::util::webauthn_call;

/// The webauthn.dll API version that added PRF inputs to
/// [WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS], in its version 6.
pub(super) const WEBAUTHN_API_VERSION_4: u32 = 4;

pub(super) const WEBAUTHN_ASSERTION_VERSION_3: u32 = 3;
pub(super) const WEBAUTHN_ASSERTION_VERSION_4: u32 = 4;
pub(super) const WEBAUTHN_ASSERTION_VERSION_6: u32 = 6;

/// Supported by every webauthn.dll API version.
pub(super) const WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_4: u32 = 4;
/// Requires [WEBAUTHN_API_VERSION_4].
pub(super) const WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_6: u32 = 6;

/// Pass the values in [WEBAUTHN_HMAC_SECRET_SALT_VALUES] through as raw
/// hmac-secret salts instead of hashing them as PRF inputs.
pub(super) const WEBAUTHN_AUTHENTICATOR_HMAC_SECRET_VALUES_FLAG: u32 = 0x00100000;

pub(super) const WEBAUTHN_AUTHENTICATOR_ATTACHMENT_ANY: u32 = 0;
pub(super) const WEBAUTHN_AUTHENTICATOR_ATTACHMENT_PLATFORM: u32 = 1;
pub(super) const WEBAUTHN_AUTHENTICATOR_ATTACHMENT_CROSS_PLATFORM: u32 = 2;

pub(super) const WEBAUTHN_CLIENT_DATA_CURRENT_VERSION: u32 = 1;

pub(super) const WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8: u32 = 8;

pub(super) const WEBAUTHN_CREDENTIAL_CURRENT_VERSION: u32 = 1;
pub(super) const WEBAUTHN_CREDENTIAL_EX_CURRENT_VERSION: u32 = 1;
pub(super) const WEBAUTHN_CREDENTIAL_TYPE_PUBLIC_KEY: PCWSTR = w!("public-key");

/// Length of a single raw hmac-secret salt, and of a single PRF output.
pub(super) const WEBAUTHN_CTAP_ONE_HMAC_SECRET_LENGTH: usize = 32;

pub(super) const WEBAUTHN_HASH_ALGORITHM_SHA_256: PCWSTR = w!("SHA-256");

pub(super) const WEBAUTHN_USER_VERIFICATION_REQUIREMENT_ANY: u32 = 0;
pub(super) const WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED: u32 = 1;
pub(super) const WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED: u32 = 2;
pub(super) const WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED: u32 = 3;

// WebAuthn Attestation Decode types
pub(super) const WEBAUTHN_ATTESTATION_DECODE_NONE: u32 = 0;

/// The result of a WebAuthNAuthenticatorGetAssertion call.
///
/// webauthn.dll only allocates the fields up to and including the version
/// specified in `dwVersion`.
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_ASSERTION {
    /// Version of this structure, to allow for modifications in the future.
    pub(super) dwVersion: u32,

    /// Size of cbAuthenticatorData.
    pub(super) cbAuthenticatorData: u32,
    /// Authenticator data that was created for this assertion.
    // _Field_size_bytes_(cbAuthenticatorData)
    pub(super) pbAuthenticatorData: *const u8,

    /// Size of pbSignature.
    pub(super) cbSignature: u32,
    /// Signature that was generated for this assertion.
    // _Field_size_bytes_(cbSignature)
    pub(super) pbSignature: *const u8,

    /// Credential that was used for this assertion.
    pub(super) Credential: WEBAUTHN_CREDENTIAL,

    /// Size of User Id
    pub(super) cbUserId: u32,
    /// UserId
    // _Field_size_bytes_(cbUserId)
    pub(super) pbUserId: *const u8,

    //
    // Following fields have been added in WEBAUTHN_ASSERTION_VERSION_2
    pub(super) Extensions: WEBAUTHN_EXTENSIONS,

    /// Size of pbCredLargeBlob
    pub(super) cbCredLargeBlob: u32,
    // _Field_size_bytes_(cbCredLargeBlob)
    pub(super) pbCredLargeBlob: *const u8,

    pub(super) dwCredLargeBlobStatus: u32,

    //
    // Following fields have been added in WEBAUTHN_ASSERTION_VERSION_3
    /// PRF outputs.
    pub(super) pHmacSecret: *const WEBAUTHN_HMAC_SECRET_SALT,

    //
    // Following fields have been added in WEBAUTHN_ASSERTION_VERSION_4
    /// One of the WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transport that was used.
    pub(super) dwUsedTransport: u32,

    //
    // Following fields have been added in WEBAUTHN_ASSERTION_VERSION_5
    pub(super) cbUnsignedExtensionOutputs: u32,
    // _Field_size_bytes_(cbUnsignedExtensionOutputs)
    pub(super) pbUnsignedExtensionOutputs: *const u8,

    //
    // Following fields have been added in WEBAUTHN_ASSERTION_VERSION_6
    /// UTF-8 encoded JSON serialization of the client data.
    pub(super) cbClientDataJSON: u32,
    // _Field_size_bytes_(cbClientDataJSON)
    pub(super) pbClientDataJSON: *const u8,

    /// UTF-8 encoded JSON serialization of the AuthenticationResponse.
    pub(super) cbAuthenticationResponseJSON: u32,
    // _Field_size_bytes_(cbAuthenticationResponseJSON)
    pub(super) pbAuthenticationResponseJSON: *const u8,
}

/// Options for WebAuthNAuthenticatorGetAssertion.
///
/// webauthn.dll only reads the fields up to and including the version set in
/// `dwVersion`. `dwVersion` must not be higher than the version supported by
/// the API version returned by [webauthn_get_api_version_number]. Versions 1
/// to 4 are supported by every API version.
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS {
    /// Version of this structure, to allow for modifications in the future.
    pub(super) dwVersion: u32,

    /// Time that the operation is expected to complete within.
    /// This is used as guidance, and can be overridden by the platform.
    pub(super) dwTimeoutMilliseconds: u32,

    /// Allowed Credentials List.
    pub(super) CredentialList: WEBAUTHN_CREDENTIALS,

    /// Optional extensions to parse when performing the operation.
    pub(super) Extensions: WEBAUTHN_EXTENSIONS,

    /// Optional. Platform vs Cross-Platform Authenticators.
    /// One of the WEBAUTHN_AUTHENTICATOR_ATTACHMENT_* values.
    pub(super) dwAuthenticatorAttachment: u32,

    /// User Verification Requirement.
    /// One of the WEBAUTHN_USER_VERIFICATION_REQUIREMENT_* values.
    pub(super) dwUserVerificationRequirement: u32,

    /// Flags
    pub(super) dwFlags: u32,

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_2
    /// Optional identifier for the U2F AppId. Converted to UTF8 before being hashed. Not lower
    /// cased.
    pub(super) pwszU2fAppId: *const u16, // PCWSTR

    /// If the following is non-NULL, then, set to TRUE if the above pwszU2fAppid was used instead
    /// of PCWSTR pwszRpId;
    pub(super) pbU2fAppId: *mut BOOL,

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_3
    /// Cancellation Id - Optional - See [webauthn_get_cancellation_id]
    pub(super) pCancellationId: *const GUID,

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_4
    /// Allow Credential List. If present, "CredentialList" will be ignored.
    pub(super) pAllowCredentialList: *const WEBAUTHN_CREDENTIAL_LIST,

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_5, which requires
    // WEBAUTHN_API_VERSION_3.
    /// One of the WEBAUTHN_CRED_LARGE_BLOB_OPERATION_* values.
    pub(super) dwCredLargeBlobOperation: u32,

    /// Size of pbCredLargeBlob
    pub(super) cbCredLargeBlob: u32,
    // _Field_size_bytes_(cbCredLargeBlob)
    pub(super) pbCredLargeBlob: *const u8,

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_6, which requires
    // WEBAUTHN_API_VERSION_4.
    /// PRF values which will be converted into HMAC-SECRET values according to WebAuthn Spec.
    pub(super) pHmacSecretSaltValues: *const WEBAUTHN_HMAC_SECRET_SALT_VALUES,

    /// Optional. BrowserInPrivate Mode. Defaulting to FALSE.
    pub(super) bBrowserInPrivateMode: BOOL,

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_7, which requires
    // WEBAUTHN_API_VERSION_7.
    /// Deprecated. Optional. Linked Device Connection Info.
    // PCTAPCBOR_HYBRID_STORAGE_LINKED_DATA
    pub(super) pLinkedDevice: *const c_void,

    /// Optional. Allowlist MUST contain 1 credential applicable for Hybrid transport.
    pub(super) bAutoFill: BOOL,

    /// Size of pbJsonExt
    pub(super) cbJsonExt: u32,
    // _Field_size_bytes_(cbJsonExt)
    pub(super) pbJsonExt: *const u8,

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_8, which requires
    // WEBAUTHN_API_VERSION_8.
    /// PublicKeyCredentialHints (https://w3c.github.io/webauthn/#enum-hints)
    pub(super) cCredentialHints: u32,
    // _Field_size_(cCredentialHints)
    pub(super) ppwszCredentialHints: *const *const u16, // LPCWSTR*

    //
    // The following fields have been added in
    // WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_VERSION_9, which requires
    // WEBAUTHN_API_VERSION_9.
    /// Web Origin. For Remote Web App scenario.
    pub(super) pwszRemoteWebOrigin: *const u16, // PCWSTR

    /// UTF-8 encoded JSON serialization of the PublicKeyCredentialRequestOptions.
    pub(super) cbPublicKeyCredentialRequestOptionsJSON: u32,
    // _Field_size_bytes_(cbPublicKeyCredentialRequestOptionsJSON)
    pub(super) pbPublicKeyCredentialRequestOptionsJSON: *const u8,

    /// Authenticator ID got from WebAuthNGetAuthenticatorList API.
    pub(super) cbAuthenticatorId: u32,
    // _Field_size_bytes_(cbAuthenticatorId)
    pub(super) pbAuthenticatorId: *const u8,
}

impl WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS {
    /// Returns options of the given version, with every other field zero or
    /// null.
    pub(super) fn new(version: u32) -> Self {
        Self {
            dwVersion: version,
            // SAFETY: Every field is an integer, a BOOL, a raw pointer, or a
            // struct of those, for which all zero bytes is a valid value.
            ..unsafe { std::mem::zeroed() }
        }
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_CLIENT_DATA {
    /// Version of this structure, to allow for modifications in the future.
    /// This field is required and should be set to
    /// [WEBAUTHN_CLIENT_DATA_CURRENT_VERSION].
    pub(super) dwVersion: u32,

    /// Size of the pbClientDataJSON field.
    pub(super) cbClientDataJSON: u32,
    /// UTF-8 encoded JSON serialization of the client data.
    // _Field_size_bytes_(cbClientDataJSON)
    pub(super) pbClientDataJSON: *const u8,

    /// Hash algorithm ID used to hash the pbClientDataJSON field.
    pub(super) pwszHashAlgId: *const u16, // LPCWSTR
}

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
pub(super) struct WEBAUTHN_CREDENTIAL {
    /// Version of this structure, to allow for modifications in the future.
    pub(super) dwVersion: u32,

    /// Size of pbID.
    pub(super) cbId: u32,
    /// Unique ID for this particular credential.
    // _Field_size_bytes_(cbId)
    pub(super) pbId: *const u8,

    /// Well-known credential type specifying what this particular credential is.
    pub(super) pwszCredentialType: *const u16, // LPCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_CREDENTIALS {
    pub(super) cCredentials: u32,
    // _Field_size_(cCredentials)
    pub(super) pCredentials: *const WEBAUTHN_CREDENTIAL,
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

/// PRF values.
///
/// By default, these values are treated as PRF salt inputs and converted into
/// raw hmac-secret salt values as per the PRF extension:
/// `SHA-256(UTF8Encode("WebAuthn PRF") || 0x00 || Value)`.
///
/// If [WEBAUTHN_AUTHENTICATOR_HMAC_SECRET_VALUES_FLAG] is set in
/// [WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS::dwFlags], the values are
/// passed through as raw hmac-secret salts and MUST be
/// [WEBAUTHN_CTAP_ONE_HMAC_SECRET_LENGTH] bytes long.
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_HMAC_SECRET_SALT {
    /// Size of pbFirst.
    pub(super) cbFirst: u32,
    /// Required
    // _Field_size_bytes_(cbFirst)
    pub(super) pbFirst: *mut u8,

    /// Size of pbSecond.
    pub(super) cbSecond: u32,
    // _Field_size_bytes_(cbSecond)
    pub(super) pbSecond: *mut u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_CRED_WITH_HMAC_SECRET_SALT {
    /// Size of pbCredID.
    pub(super) cbCredID: u32,
    // _Field_size_bytes_(cbCredID)
    /// Required
    pub(super) pbCredID: *mut u8,

    /// PRF values for the above credential. Required.
    pub(super) pHmacSecretSalt: *mut WEBAUTHN_HMAC_SECRET_SALT,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(super) struct WEBAUTHN_HMAC_SECRET_SALT_VALUES {
    /// PRF values to use when the selected credential does not have an entry
    /// in `pCredWithHmacSecretSaltList`. Corresponds to `prf.eval`.
    pub(super) pGlobalHmacSalt: *mut WEBAUTHN_HMAC_SECRET_SALT,

    /// Corresponds to `prf.evalByCredential`.
    pub(super) cCredWithHmacSecretSaltList: u32,
    // _Field_size_(cCredWithHmacSecretSaltList)
    pub(super) pCredWithHmacSecretSaltList: *mut WEBAUTHN_CRED_WITH_HMAC_SECRET_SALT,
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

webauthn_call!("WebAuthNGetApiVersionNumber" as
/// Returns the API version of webauthn.dll, which determines the struct
/// versions and features that are available. See the WEBAUTHN_API_VERSION_*
/// constants.
fn webauthn_get_api_version_number() -> u32);

webauthn_call!("WebAuthNAuthenticatorGetAssertion" as
/// Requests an assertion from an authenticator, prompting the user to select a
/// credential.
///
/// This call blocks until the user completes or dismisses the prompt, the
/// timeout expires, or the operation is cancelled with
/// [webauthn_cancel_current_operation].
///
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
///
/// # Arguments
/// - `hWnd`: The window that the OS prompt should be modal to.
/// - `pwszRpId`: The RP ID for the request.
/// - `pWebAuthNClientData`: The client data JSON to be hashed and signed.
/// - `pWebAuthNGetAssertionOptions`: Optional. Options for the request.
/// - `ppWebAuthNAssertion`: An indirect pointer to a [WEBAUTHN_ASSERTION],
///   which will be written to on success, and must be freed by a call to
///   [webauthn_free_assertion].
fn webauthn_authenticator_get_assertion(
    hWnd: HWND,
    pwszRpId: *const u16,
    pWebAuthNClientData: *const WEBAUTHN_CLIENT_DATA,
    pWebAuthNGetAssertionOptions: *const WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS,
    ppWebAuthNAssertion: *mut *mut WEBAUTHN_ASSERTION
) -> HRESULT);

webauthn_call!("WebAuthNFreeAssertion" as
/// Frees an assertion returned from [webauthn_authenticator_get_assertion].
///
/// # Arguments
/// - `pWebAuthNAssertion`: A pointer to the [WEBAUTHN_ASSERTION] to be freed.
fn webauthn_free_assertion(pWebAuthNAssertion: *mut WEBAUTHN_ASSERTION) -> ());

webauthn_call!("WebAuthNGetCancellationId" as
/// Generates an ID that can be set in
/// [WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS::pCancellationId] and later
/// passed to [webauthn_cancel_current_operation] to cancel the operation.
///
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
///
/// # Arguments
/// - `pCancellationId`: A pointer to a GUID, which will be written to on success.
fn webauthn_get_cancellation_id(pCancellationId: *mut GUID) -> HRESULT);

webauthn_call!("WebAuthNCancelCurrentOperation" as
/// Cancels an in-progress operation that was started with the given
/// cancellation ID. The cancelled operation returns an error HRESULT.
///
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
///
/// # Arguments
/// - `pCancellationId`: The ID returned from [webauthn_get_cancellation_id].
fn webauthn_cancel_current_operation(pCancellationId: *const GUID) -> HRESULT);

webauthn_call!("WebAuthNGetErrorName" as
/// Returns the W3C DOMException name corresponding to an HRESULT returned by
/// webauthn.dll, e.g. `"NotAllowedError"` for a cancelled operation. Unknown
/// values return `"UnknownError"`.
///
/// The returned string is owned by webauthn.dll and must not be freed.
fn webauthn_get_error_name(hr: HRESULT) -> *const u16);
