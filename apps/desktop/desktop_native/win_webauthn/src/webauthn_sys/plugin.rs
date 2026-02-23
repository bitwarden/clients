//! Types from webauthn.dll as defined in webauthnplugin.h and pluginauthenticator.h.

use std::num::NonZeroU32;

use windows::{
    core::{BOOL, GUID, HRESULT},
    Win32::Foundation::HWND,
};

use super::{
    util::webauthn_call, WEBAUTHN_COSE_CREDENTIAL_PARAMETERS, WEBAUTHN_CREDENTIAL_ATTESTATION,
    WEBAUTHN_CREDENTIAL_LIST, WEBAUTHN_RP_ENTITY_INFORMATION, WEBAUTHN_USER_ENTITY_INFORMATION,
};

/// Plugin lock status enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum PLUGIN_LOCK_STATUS {
    PluginLocked = 0,
    PluginUnlocked = 1,
}

/// Windows WebAuthn Authenticator Options structure
/// Header File Name: _WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS {
    /// Version of this structure, to allow for modifications in the future.
    pub(crate) dwVersion: u32,
    /// "up" option: +1=TRUE, 0=Not defined, -1=FALSE
    pub(crate) lUp: i32,
    /// "uv" option: +1=TRUE, 0=Not defined, -1=FALSE
    pub(crate) lUv: i32,
    /// "rk" option: +1=TRUE, 0=Not defined, -1=FALSE
    pub(crate) lRequireResidentKey: i32,
}

#[repr(C)]
pub(crate) struct WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY {
    /// Version of this structure, to allow for modifications in the future.
    pub _dwVersion: u32,

    /// Key type
    pub _lKty: i32,

    /// Hash Algorithm: ES256, ES384, ES512
    pub _lAlg: i32,

    /// Curve
    pub _lCrv: i32,

    /// Size of "x" (X Coordinate)
    pub _cbX: u32,

    /// "x" (X Coordinate) data. Big Endian.
    pub _pbX: *const u8,

    /// Size of "y" (Y Coordinate)
    pub _cbY: u32,

    /// "y" (Y Coordinate) data. Big Endian.
    pub _pbY: *const u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
    /// Version of this structure, to allow for modifications in the future.
    pub dwVersion: u32,
    /// RP ID (after UTF-8 to Unicode conversion)
    pub pwszRpId: *const u16,
    /// Input RP ID size (raw UTF-8 bytes before conversion)
    pub cbRpId: u32,
    /// Raw UTF-8 bytes before conversion to UTF-16 in pwszRpId. These are the
    /// bytes to be hashed in the Authenticator Data.
    pub pbRpId: *const u8,
    /// Client Data Hash size
    pub cbClientDataHash: u32,
    /// Client Data Hash data
    pub pbClientDataHash: *const u8,
    /// Credentials used for inclusion
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    /// CBOR extensions map size
    pub cbCborExtensionsMap: u32,
    /// CBOR extensions map data
    pub pbCborExtensionsMap: *const u8,
    /// Authenticator Options (Optional)
    pub pAuthenticatorOptions: *const WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS,

    // Pin Auth (Optional)
    /// Zero length PinAuth is included in the request
    pub fEmptyPinAuth: BOOL,
    /// Pin Auth size
    pub cbPinAuth: u32,
    /// Pin Auth data
    pub pbPinAuth: *const u8,

    /// HMAC Salt Extension (Optional)
    pub pHmacSaltExtension: *const WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION,

    /// PRF Extension / HMAC secret salt values size
    pub cbHmacSecretSaltValues: u32,
    /// PRF Extension / HMAC secret salt values data
    pub pbHmacSecretSaltValues: *const u8,

    /// Pin protocol
    pub dwPinProtocol: u32,

    /// "credBlob": true extension
    pub lCredBlobExt: i32,

    /// "largeBlobKey": true extension
    pub lLargeBlobKeyExt: i32,

    /// "largeBlob" extension operation
    pub dwCredLargeBlobOperation: u32,
    /// Large blob compressed size
    pub cbCredLargeBlobCompressed: u32,
    /// Large blob compressed data
    pub pbCredLargeBlobCompressed: *const u8,
    /// Large blob original size
    pub dwCredLargeBlobOriginalSize: u32,

    /// "json" extension size. Nonzero if present
    pub cbJsonExt: u32,
    /// "json" extension data
    pub pbJsonExt: *const u8,
}

#[repr(C)]
pub(crate) struct WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION {
    /// Version of this structure, to allow for modifications in the future.
    pub _dwVersion: u32,

    /// Platform's key agreement public key
    pub _pKeyAgreement: *const WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY,

    /// Encrypted salt size
    pub _cbEncryptedSalt: u32,
    /// Encrypted salt data
    pub _pbEncryptedSalt: *const u8,

    /// Salt authentication size
    pub _cbSaltAuth: u32,
    /// Salt authentication data
    pub _pbSaltAuth: *const u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST<'a> {
    /// Version of this structure, to allow for modifications in the future.
    pub dwVersion: u32,
    /// Input RP ID size (raw UTF-8 bytes before conversion)
    pub cbRpId: u32,
    /// Input RP ID data (bytes hashed in Authenticator Data)
    pub pbRpId: *const u8,
    /// Client Data Hash size
    pub cbClientDataHash: u32,
    /// Client Data Hash data
    pub pbClientDataHash: *const u8,
    /// RP Information
    pub pRpInformation: *const WEBAUTHN_RP_ENTITY_INFORMATION,
    /// User Information
    pub pUserInformation: *const WEBAUTHN_USER_ENTITY_INFORMATION,
    /// Crypto Parameters
    pub WebAuthNCredentialParameters: WEBAUTHN_COSE_CREDENTIAL_PARAMETERS,
    /// Credentials used for exclusion
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    /// CBOR extensions map size
    pub cbCborExtensionsMap: u32,
    /// CBOR extensions map data
    pub pbCborExtensionsMap: *const u8,
    /// Authenticator Options (Optional)
    pub pAuthenticatorOptions: Option<&'a WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS>,

    // Pin Auth (Optional)
    /// Indicates zero length PinAuth is included in the request
    pub fEmptyPinAuth: BOOL,
    /// Pin Auth size
    pub cbPinAuth: u32,
    /// Pin Auth data
    pub pbPinAuth: *const u8,

    /// "hmac-secret": true extension
    pub lHmacSecretExt: i32,

    /// "hmac-secret-mc" extension
    pub pHmacSecretMcExtension: *const WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION,

    /// "prf" extension
    pub lPrfExt: i32,
    /// HMAC secret salt values size
    pub cbHmacSecretSaltValues: u32,
    /// HMAC secret salt values data
    pub pbHmacSecretSaltValues: *const u8,

    /// "credProtect" extension. Nonzero if present
    pub dwCredProtect: Option<NonZeroU32>,

    /// Nonzero if present
    pub dwPinProtocol: Option<NonZeroU32>,

    /// Nonzero if present
    pub dwEnterpriseAttestation: Option<NonZeroU32>,

    /// "credBlob" extension. Nonzero if present
    pub cbCredBlobExt: Option<NonZeroU32>,
    /// "credBlob" extension data
    pub pbCredBlobExt: *const u8,

    /// "largeBlobKey": true extension
    pub lLargeBlobKeyExt: i32,

    /// "largeBlob": extension
    pub dwLargeBlobSupport: u32,

    /// "minPinLength": true extension
    pub lMinPinLengthExt: i32,

    /// "json" extension. Nonzero if present
    pub cbJsonExt: u32,
    /// "json" extension data
    pub pbJsonExt: *const u8,
}

/// Used when adding a Windows plugin authenticator (stable API).
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS
/// Header File Usage: WebAuthNPluginAddAuthenticator()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
    /// Authenticator Name
    pub(crate) pwszAuthenticatorName: *const u16,

    /// Plugin COM ClsId
    pub(crate) rclsid: *const GUID,

    /// Plugin RPID
    ///
    /// Required for a nested WebAuthN call originating from a plugin.
    pub(crate) pwszPluginRpId: *const u16,

    /// Plugin Authenticator Logo for the Light themes.  base64-encoded SVG 1.1
    ///
    /// The data should be encoded as `UTF16(BASE64(UTF8(svg_text)))`.
    pub(crate) pwszLightThemeLogoSvg: *const u16,

    /// Plugin Authenticator Logo for the Dark themes.  base64-encoded SVG 1.1
    ///
    /// The data should be encoded as `UTF16(BASE64(UTF8(svg_text)))`.
    pub(crate) pwszDarkThemeLogoSvg: *const u16,

    /// CTAP CBOR-encoded authenticatorGetInfo response (size)
    pub(crate) cbAuthenticatorInfo: u32,
    /// CTAP CBOR-encoded authenticatorGetInfo output
    pub(crate) pbAuthenticatorInfo: *const u8,

    /// Count of supported RP IDs
    pub(crate) cSupportedRpIds: u32,
    /// List of supported RP IDs (Relying Party IDs).
    ///
    /// Should be null if all RPs are supported.
    pub(crate) pbSupportedRpIds: *const *const u16,
}

/// Used as a response type when adding a Windows plugin authenticator.
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
/// Header File Usage: WebAuthNPluginAddAuthenticator()
///                    WebAuthNPluginFreeAddAuthenticatorResponse()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
    /// Size in bytes of the public key pointed to by `pbOpSignPubKey`.
    pub(crate) cbOpSignPubKey: u32,
    /// Pointer to a [BCRYPT_KEY_BLOB](windows::Win32::Security::Cryptography::BCRYPT_KEY_BLOB).
    pub(crate) pbOpSignPubKey: *mut u8,
}

#[repr(C)]
pub(crate) struct WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST {
    pub(crate) transactionId: GUID,
    pub(crate) cbRequestSignature: u32,
    pub(crate) pbRequestSignature: *const u8,
}

/// Represents a credential.
/// Header File Name: _WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS
/// Header File Usage: WebAuthNPluginAuthenticatorAddCredentials, etc.
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS {
    /// Credential Identifier bytes (size)
    pub credential_id_byte_count: u32,
    /// Credential Identifier bytes (data, required)
    pub credential_id_pointer: *const u8,
    /// Identifier for the RP (required)
    pub rpid: *const u16,
    /// Friendly name of the Relying Party (required)
    pub rp_friendly_name: *const u16,
    /// User Identifier bytes (size)
    pub user_id_byte_count: u32,
    /// User Identifier bytes (data, required)
    pub user_id_pointer: *const u8,
    /// Detailed account name (e.g., "john.p.smith@example.com")
    pub user_name: *const u16,
    /// Friendly name for the user account (e.g., "John P. Smith")
    pub user_display_name: *const u16,
}

/// Used when creating and asserting credentials.
/// Header File Name: _WEBAUTHN_PLUGIN_OPERATION_REQUEST
/// Header File Usage: MakeCredential()
///                    GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(crate) struct WEBAUTHN_PLUGIN_OPERATION_REQUEST {
    /// Window handle to client that requesting a WebAuthn credential.
    pub hWnd: HWND,
    pub transactionId: GUID,
    pub cbRequestSignature: u32,
    /// Signature over request made with the signing key created during authenticator registration.
    pub pbRequestSignature: *mut u8,
    pub requestType: WEBAUTHN_PLUGIN_REQUEST_TYPE,
    pub cbEncodedRequest: u32,
    pub pbEncodedRequest: *const u8,
}

/// Plugin request type enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub enum WEBAUTHN_PLUGIN_REQUEST_TYPE {
    // This is being used to check the value that Windows gives us, but it isn't
    // ever constructed by our library.
    #[allow(unused)]
    CTAP2_CBOR = 0x01,
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

#[repr(C)]
#[derive(Debug)]
pub(crate) struct WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST {
    /// Windows handle of the top-level window displayed by the plugin and
    /// currently is in foreground as part of the ongoing WebAuthn operation.
    pub(crate) hwnd: HWND,

    /// The WebAuthn transaction id from the WEBAUTHN_PLUGIN_OPERATION_REQUEST
    pub(crate) rguidTransactionId: *const GUID,

    /// The username attached to the credential that is in use for this WebAuthn
    /// operation.
    pub(crate) pwszUsername: *const u16,

    /// A text hint displayed on the Windows Hello prompt.
    pub(crate) pwszDisplayHint: *const u16,
}

webauthn_call!("WebAuthNDecodeGetAssertionRequest" as
/// Decodes a CTAP GetAssertion request.
///
/// On success, a [WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST] will be written to
/// `ppGetAssertionRequest`, which must be freed by a call to
/// [webauthn_free_decoded_get_assertion_request].
/// 
/// # Arguments
/// - `pbEncoded`: a COM-allocated buffer pointing to a CTAP CBOR get assertion request.
/// - `ppGetAssertionRequest`: An indirect pointer to a [WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST].
/// 
/// # Safety
/// - `pbEncoded` must have been allocated by Windows COM.
/// - `pbEncoded` must be non-null and have the length specified in cbEncoded.
fn webauthn_decode_get_assertion_request(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppGetAssertionRequest: *mut *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST
) -> HRESULT);

webauthn_call!("WebAuthNDecodeMakeCredentialRequest" as
/// Decodes a CTAP CBOR `authenticatorMakeCredential` request.
///
/// On success, a [WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST] will be written to
/// `ppMakeCredentialRequest`, which must be freed by a call to
/// [webauthn_free_decoded_make_credential_request].
/// 
/// # Arguments
/// - `pbEncoded`: a COM-allocated buffer pointing to a CTAP CBOR make credential request.
/// - `ppMakeCredentialRequest`: An indirect pointer to a [WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST].
/// 
/// # Safety
/// - `pbEncoded` must have been allocated by Windows COM.
/// - `pbEncoded` must be non-null and have the length specified in cbEncoded.
fn webauthn_decode_make_credential_request(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppMakeCredentialRequest: *mut *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST
) -> HRESULT);

webauthn_call!("WebAuthNEncodeMakeCredentialResponse" as 
/// Encode a credential attestation response to a COM-allocated byte buffer
/// containing a CTAP CBOR `authenticatorMakeCredential` response structure.
/// 
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments
/// - `pCredentialAttestation`: A pointer to [WEBAUTHN_CREDENTIAL_ATTESTATION] to encode.
/// - `pcbResp`: A pointer to a u32, which will be filled with the length of the response buffer.
/// - `ppbResponse`: An indirect pointer to a byte buffer, which will be written to on succces.
fn webauthn_encode_make_credential_response(
    pCredentialAttestation: *const WEBAUTHN_CREDENTIAL_ATTESTATION,
    pcbResp: *mut u32,
    ppbResponse: *mut *mut u8
) -> HRESULT);

webauthn_call!("WebAuthNFreeDecodedGetAssertionRequest" as
/// Frees a decoded get assertion request from [webauthn_free_decoded_get_assertion_request].
/// 
/// # Arguments
/// - `pGetAssertionRequest`: An pointer to a [WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST] to be freed.
fn webauthn_free_decoded_get_assertion_request(
    pGetAssertionRequest: *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST
) -> ());

webauthn_call!("WebAuthNFreeDecodedMakeCredentialRequest" as
/// Frees a decoded make credential request from [webauthn_free_decoded_make_credential_request].
/// 
/// # Arguments
/// - `pMakeCredentialRequest`: An pointer to a [WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST] to be freed.
fn webauthn_free_decoded_make_credential_request(
    pMakeCredentialRequest: *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST
) -> ());

webauthn_call!("WebAuthNPluginAddAuthenticator" as
/// Register authenticator info for a plugin COM server.
/// 
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments
/// - `pPluginAddAuthenticatorOptions`: Details about the authenticator to set.
/// - `ppPluginAddAuthenticatorResponse`:
///    An indirect pointer to a [WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE], which will be written to on success.
///    If the request succeeds, the data must be freed by a call to [webauthn_plugin_free_add_authenticator_response].
fn webauthn_plugin_add_authenticator(
    pPluginAddAuthenticatorOptions: *const WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    ppPluginAddAuthenticatorResponse: *mut *mut WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
) -> HRESULT);

webauthn_call!("WebAuthNPluginAuthenticatorAddCredentials" as
/// Add metadata for a list of WebAuthn credentials to the autofill store for
/// this plugin authenticator.
/// 
/// This will make the credentials available for discovery in Windows Hello
/// WebAuthn autofill dialogs.
///
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments
/// - `rclsid`: The CLSID corresponding to this plugin's COM server.
/// - `cCredentialDetails`: The number of credentials in the array pointed to by `pCredentialDetails`.
/// - `pCredentialDetails`: An array of credential metadata.
fn webauthn_plugin_authenticator_add_credentials(
    rclsid: *const GUID,
    cCredentialDetails: u32,
    pCredentialDetails: *const WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS
) -> HRESULT);

webauthn_call!("WebAuthNPluginAuthenticatorRemoveAllCredentials" as
/// Removes metadata for all credentials currently stored in the autofill store
/// for this plugin authenticator.
/// 
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments
/// - `rclsid`: The CLSID corresponding to this plugin's COM server.
fn webauthn_plugin_authenticator_remove_all_credentials(rclsid: *const GUID) -> HRESULT);

webauthn_call!("WebAuthNPluginFreeAddAuthenticatorResponse" as
/// Free memory from a [WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE].
/// 
/// # Arguments
/// - `pPluginAddAuthenticatorResponse`: An pointer to a [WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE] to be freed.
fn webauthn_plugin_free_add_authenticator_response(
    pPluginAddAuthenticatorResponse: *mut WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
) -> ());

webauthn_call!("WebAuthNPluginFreeUserVerificationResponse" as
/// Free a user verification response received from a call to [webauthn_plugin_perform_user_verification].
fn webauthn_plugin_free_user_verification_response(
    pbResponse: *mut u8
) -> ());

webauthn_call!("WebAuthNPluginPerformUserVerification" as
/// Request user verification for a WebAuthn operation.
/// 
/// The OS will prompt the user for verification, and if the user is
/// successfully verified, will write a signature to `ppbResponse`, which must
/// be freed by a call to [webauthn_plugin_free_user_verification_response].
/// 
/// The signature is over the SHA-256 hash of the original WebAuthn operation request buffer
/// corresponding to `pPluginUserVerification.rguidTransactionId`. It can be
/// verified using the user verification public key, which can be retrieved
/// using
/// [webauthn_plugin_get_user_verification_public_key][crate::plugin::crypto::webauthn_plugin_get_user_verification_public_key].
///
/// This request will block while the user interacts with the dialog.
///
/// # Arguments
/// - `pPluginUserVerification`: The user verification prompt and transaction context for the request.
/// - `pcbResponse`: Length in bytes of the signature.
/// - `ppbResponse`: The signature of the request.
fn webauthn_plugin_perform_user_verification(
    pPluginUserVerification: *const WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST,
    pcbResponse: *mut u32,
    ppbResponse: *mut *mut u8
) -> HRESULT);
