//! Types from webauthn.dll as defined in webauthnplugin.h and pluginauthenticator.h.

use std::num::NonZeroU32;

use windows::{
    core::{BOOL, GUID, HRESULT},
    Win32::{Foundation::HWND, Security::Cryptography::BCRYPT_KEY_BLOB},
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
    pub(in crate::api) dwVersion: u32,
    /// "up" option: +1=TRUE, 0=Not defined, -1=FALSE
    pub(in crate::api) lUp: i32,
    /// "uv" option: +1=TRUE, 0=Not defined, -1=FALSE
    pub(in crate::api) lUv: i32,
    /// "rk" option: +1=TRUE, 0=Not defined, -1=FALSE
    pub(in crate::api) lRequireResidentKey: i32,
}

#[repr(C)]
pub(in crate::api) struct WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY {
    /// Version of this structure, to allow for modifications in the future.
    pub(in crate::api) _dwVersion: u32,

    /// Key type
    pub(in crate::api) _lKty: i32,

    /// Hash Algorithm: ES256, ES384, ES512
    pub(in crate::api) _lAlg: i32,

    /// Curve
    pub(in crate::api) _lCrv: i32,

    /// Size of "x" (X Coordinate)
    pub(in crate::api) _cbX: u32,

    /// "x" (X Coordinate) data. Big Endian.
    pub(in crate::api) _pbX: *const u8,

    /// Size of "y" (Y Coordinate)
    pub(in crate::api) _cbY: u32,

    /// "y" (Y Coordinate) data. Big Endian.
    pub(in crate::api) _pbY: *const u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(in crate::api) struct WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST<'a> {
    /// Version of this structure, to allow for modifications in the future.
    pub(in crate::api) dwVersion: u32,
    /// RP ID (after UTF-8 to Unicode conversion)
    pub(in crate::api) pwszRpId: *const u16,
    /// Input RP ID size (raw UTF-8 bytes before conversion)
    pub(in crate::api) cbRpId: u32,
    /// Raw UTF-8 bytes before conversion to UTF-16 in pwszRpId. These are the
    /// bytes to be hashed in the Authenticator Data.
    pub(in crate::api) pbRpId: *const u8,
    /// Client Data Hash size
    pub(in crate::api) cbClientDataHash: u32,
    /// Client Data Hash data
    pub(in crate::api) pbClientDataHash: *const u8,
    /// Credentials used for inclusion
    pub(in crate::api) CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    /// CBOR extensions map size
    pub(in crate::api) cbCborExtensionsMap: u32,
    /// CBOR extensions map data
    pub(in crate::api) pbCborExtensionsMap: *const u8,
    /// Authenticator Options (Optional)
    pub(in crate::api) pAuthenticatorOptions: Option<&'a WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS>,

    // Pin Auth (Optional)
    /// Zero length PinAuth is included in the request
    pub(in crate::api) fEmptyPinAuth: BOOL,
    /// Pin Auth size
    pub(in crate::api) cbPinAuth: u32,
    /// Pin Auth data
    pub(in crate::api) pbPinAuth: *const u8,

    /// HMAC Salt Extension (Optional)
    pub(in crate::api) pHmacSaltExtension: *const WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION,

    /// PRF Extension / HMAC secret salt values size
    pub(in crate::api) cbHmacSecretSaltValues: u32,
    /// PRF Extension / HMAC secret salt values data
    pub(in crate::api) pbHmacSecretSaltValues: *const u8,

    /// Pin protocol
    pub(in crate::api) dwPinProtocol: u32,

    /// "credBlob": true extension
    pub(in crate::api) lCredBlobExt: i32,

    /// "largeBlobKey": true extension
    pub(in crate::api) lLargeBlobKeyExt: i32,

    /// "largeBlob" extension operation
    pub(in crate::api) dwCredLargeBlobOperation: u32,
    /// Large blob compressed size
    pub(in crate::api) cbCredLargeBlobCompressed: u32,
    /// Large blob compressed data
    pub(in crate::api) pbCredLargeBlobCompressed: *const u8,
    /// Large blob original size
    pub(in crate::api) dwCredLargeBlobOriginalSize: u32,

    /// "json" extension size. Nonzero if present
    pub(in crate::api) cbJsonExt: u32,
    /// "json" extension data
    pub(in crate::api) pbJsonExt: *const u8,
}

#[repr(C)]
pub(in crate::api) struct WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION {
    /// Version of this structure, to allow for modifications in the future.
    pub(in crate::api) _dwVersion: u32,

    /// Platform's key agreement public key
    pub(in crate::api) _pKeyAgreement: *const WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY,

    /// Encrypted salt size
    pub(in crate::api) _cbEncryptedSalt: u32,
    /// Encrypted salt data
    pub(in crate::api) _pbEncryptedSalt: *const u8,

    /// Salt authentication size
    pub(in crate::api) _cbSaltAuth: u32,
    /// Salt authentication data
    pub(in crate::api) _pbSaltAuth: *const u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(in crate::api) struct WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST<'a> {
    /// Version of this structure, to allow for modifications in the future.
    pub(in crate::api) dwVersion: u32,
    /// Input RP ID size (raw UTF-8 bytes before conversion)
    pub(in crate::api) cbRpId: u32,
    /// Input RP ID data (bytes hashed in Authenticator Data)
    pub(in crate::api) pbRpId: *const u8,
    /// Client Data Hash size
    pub(in crate::api) cbClientDataHash: u32,
    /// Client Data Hash data
    pub(in crate::api) pbClientDataHash: *const u8,
    /// RP Information
    pub(in crate::api) pRpInformation: *const WEBAUTHN_RP_ENTITY_INFORMATION,
    /// User Information
    pub(in crate::api) pUserInformation: *const WEBAUTHN_USER_ENTITY_INFORMATION,
    /// Crypto Parameters
    pub(in crate::api) WebAuthNCredentialParameters: WEBAUTHN_COSE_CREDENTIAL_PARAMETERS,
    /// Credentials used for exclusion
    pub(in crate::api) CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    /// CBOR extensions map size
    pub(in crate::api) cbCborExtensionsMap: u32,
    /// CBOR extensions map data
    pub(in crate::api) pbCborExtensionsMap: *const u8,
    /// Authenticator Options (Optional)
    pub(in crate::api) pAuthenticatorOptions: Option<&'a WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS>,

    // Pin Auth (Optional)
    /// Indicates zero length PinAuth is included in the request
    pub(in crate::api) fEmptyPinAuth: BOOL,
    /// Pin Auth size
    pub(in crate::api) cbPinAuth: u32,
    /// Pin Auth data
    pub(in crate::api) pbPinAuth: *const u8,

    /// "hmac-secret": true extension
    pub(in crate::api) lHmacSecretExt: i32,

    /// "hmac-secret-mc" extension
    pub(in crate::api) pHmacSecretMcExtension: *const WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION,

    /// "prf" extension
    pub(in crate::api) lPrfExt: i32,
    /// HMAC secret salt values size
    pub(in crate::api) cbHmacSecretSaltValues: u32,
    /// HMAC secret salt values data
    pub(in crate::api) pbHmacSecretSaltValues: *const u8,

    /// "credProtect" extension. Nonzero if present
    pub(in crate::api) dwCredProtect: Option<NonZeroU32>,

    /// Nonzero if present
    pub(in crate::api) dwPinProtocol: Option<NonZeroU32>,

    /// Nonzero if present
    pub(in crate::api) dwEnterpriseAttestation: Option<NonZeroU32>,

    /// "credBlob" extension. Nonzero if present
    pub(in crate::api) cbCredBlobExt: Option<NonZeroU32>,
    /// "credBlob" extension data
    pub(in crate::api) pbCredBlobExt: *const u8,

    /// "largeBlobKey": true extension
    pub(in crate::api) lLargeBlobKeyExt: i32,

    /// "largeBlob": extension
    pub(in crate::api) dwLargeBlobSupport: u32,

    /// "minPinLength": true extension
    pub(in crate::api) lMinPinLengthExt: i32,

    /// "json" extension. Nonzero if present
    pub(in crate::api) cbJsonExt: u32,
    /// "json" extension data
    pub(in crate::api) pbJsonExt: *const u8,
}

/// Used when adding a Windows plugin authenticator (stable API).
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS
/// Header File Usage: WebAuthNPluginAddAuthenticator()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(in crate::api) struct WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
    /// Authenticator Name
    pub(in crate::api) pwszAuthenticatorName: *const u16,

    /// Plugin COM ClsId
    pub(in crate::api) rclsid: *const GUID,

    /// Plugin RPID
    ///
    /// Required for a nested WebAuthN call originating from a plugin.
    pub(in crate::api) pwszPluginRpId: *const u16,

    /// Plugin Authenticator Logo for the Light themes.  base64-encoded SVG 1.1
    ///
    /// The data should be encoded as `UTF16(BASE64(UTF8(svg_text)))`.
    pub(in crate::api) pwszLightThemeLogoSvg: *const u16,

    /// Plugin Authenticator Logo for the Dark themes.  base64-encoded SVG 1.1
    ///
    /// The data should be encoded as `UTF16(BASE64(UTF8(svg_text)))`.
    pub(in crate::api) pwszDarkThemeLogoSvg: *const u16,

    /// CTAP CBOR-encoded authenticatorGetInfo response (size)
    pub(in crate::api) cbAuthenticatorInfo: u32,
    /// CTAP CBOR-encoded authenticatorGetInfo output
    pub(in crate::api) pbAuthenticatorInfo: *const u8,

    /// Count of supported RP IDs
    pub(in crate::api) cSupportedRpIds: u32,
    /// List of supported RP IDs (Relying Party IDs).
    ///
    /// Should be null if all RPs are supported.
    pub(in crate::api) pbSupportedRpIds: *const *const u16,
}

/// Used as a response type when adding a Windows plugin authenticator.
/// Header File Name: _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE
/// Header File Usage: WebAuthNPluginAddAuthenticator()
///                    WebAuthNPluginFreeAddAuthenticatorResponse()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(in crate::api) struct WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
    /// Size in bytes of the public key pointed to by `pbOpSignPubKey`.
    pub(in crate::api) cbOpSignPubKey: u32,
    /// Pointer to a [BCRYPT_KEY_BLOB](windows::Win32::Security::Cryptography::BCRYPT_KEY_BLOB).
    pub(in crate::api) pbOpSignPubKey: *mut u8,
}

#[repr(C)]
pub(in crate::api) struct WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST {
    pub(in crate::api) transactionId: GUID,
    pub(in crate::api) cbRequestSignature: u32,
    pub(in crate::api) pbRequestSignature: *const u8,
}

/// Represents a credential.
/// Header File Name: _WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS
/// Header File Usage: WebAuthNPluginAuthenticatorAddCredentials, etc.
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(in crate::api) struct WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS {
    /// Credential Identifier bytes (size)
    pub(in crate::api) credential_id_byte_count: u32,
    /// Credential Identifier bytes (data, required)
    pub(in crate::api) credential_id_pointer: *const u8,
    /// Identifier for the RP (required)
    pub(in crate::api) rpid: *const u16,
    /// Friendly name of the Relying Party (required)
    pub(in crate::api) rp_friendly_name: *const u16,
    /// User Identifier bytes (size)
    pub(in crate::api) user_id_byte_count: u32,
    /// User Identifier bytes (data, required)
    pub(in crate::api) user_id_pointer: *const u8,
    /// Detailed account name (e.g., "john.p.smith@example.com")
    pub(in crate::api) user_name: *const u16,
    /// Friendly name for the user account (e.g., "John P. Smith")
    pub(in crate::api) user_display_name: *const u16,
}

/// Used when creating and asserting credentials.
/// Header File Name: _WEBAUTHN_PLUGIN_OPERATION_REQUEST
/// Header File Usage: MakeCredential()
///                    GetAssertion()
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub(in crate::api) struct WEBAUTHN_PLUGIN_OPERATION_REQUEST {
    /// Window handle to client that requesting a WebAuthn credential.
    pub(in crate::api) hWnd: HWND,
    pub(in crate::api) transactionId: GUID,
    pub(in crate::api) cbRequestSignature: u32,
    /// Signature over request made with the signing key created during authenticator registration.
    pub(in crate::api) pbRequestSignature: *mut u8,
    pub(in crate::api) requestType: WEBAUTHN_PLUGIN_REQUEST_TYPE,
    pub(in crate::api) cbEncodedRequest: u32,
    pub(in crate::api) pbEncodedRequest: *const u8,
}

/// Plugin request type enum as defined in the IDL
#[repr(u32)]
#[derive(Debug, Copy, Clone)]
pub(in crate::api) enum WEBAUTHN_PLUGIN_REQUEST_TYPE {
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
pub(in crate::api) struct WEBAUTHN_PLUGIN_OPERATION_RESPONSE {
    pub(in crate::api) cbEncodedResponse: u32,
    pub(in crate::api) pbEncodedResponse: *mut u8,
}

#[repr(C)]
#[derive(Debug)]
pub(in crate::api) struct WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST {
    /// Windows handle of the top-level window displayed by the plugin and
    /// currently is in foreground as part of the ongoing WebAuthn operation.
    pub(in crate::api) hwnd: HWND,

    /// The WebAuthn transaction id from the WEBAUTHN_PLUGIN_OPERATION_REQUEST
    pub(in crate::api) rguidTransactionId: *const GUID,

    /// The username attached to the credential that is in use for this WebAuthn
    /// operation.
    pub(in crate::api) pwszUsername: *const u16,

    /// A text hint displayed on the Windows Hello prompt.
    pub(in crate::api) pwszDisplayHint: *const u16,
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

webauthn_call!("WebAuthNPluginGetUserVerificationPublicKey" as
/// Retrieve the public key used to verify user verification responses from the OS.
///
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments 
/// - `rclsid`: The CLSID corresponding to this plugin's COM server.
/// - `pcbPublicKey`: A pointer to an unsigned integer, which will be filled in with the length of the buffer at `ppbPublicKey`.
/// - `ppbPublicKey`: A pointer to a [BCRYPT_PUBLIC_KEY_BLOB], which will be written to on success.
///                   On success, this must be freed by a call to [webauthn_plugin_free_public_key_response].
fn webauthn_plugin_get_user_verification_public_key(
    rclsid: *const GUID,
    pcbPublicKey: *mut u32,
    ppbPublicKey: *mut *mut BCRYPT_KEY_BLOB,
) -> HRESULT); // Free using WebAuthNPluginFreePublicKeyResponse

webauthn_call!("WebAuthNPluginGetOperationSigningPublicKey" as
/// Retrieve the public key used to verify plugin operation requests from the OS.
/// 
/// Returns [S_OK](windows::Win32::Foundation::S_OK) on success.
/// 
/// # Arguments 
/// - `rclsid`: The CLSID corresponding to this plugin's COM server.
/// - `pcbOpSignPubKey`: A pointer to an unsigned integer, which will be filled in with the length of the buffer at `ppbOpSignPubKey`.
/// - `ppbOpSignPubKey`: An indirect pointer to a [BCRYPT_PUBLIC_KEY_BLOB], which will be written to on success.
///                      On success, this must be freed by a call to [webauthn_plugin_free_public_key_response].
fn webauthn_plugin_get_operation_signing_public_key(
    rclsid: *const GUID,
    pcbOpSignPubKey: *mut u32,
    ppbOpSignPubKey: *mut *mut BCRYPT_KEY_BLOB
) -> HRESULT); // Free using WebAuthNPluginFreePublicKeyResponse

webauthn_call!("WebAuthNPluginFreePublicKeyResponse" as
/// Free public key memory retrieved from the OS.
///
/// # Arguments
/// - `pbOpSignPubKey`: A pointer to a [BCRYPT_KEY_BLOB] retrieved from a method in this library.
fn webauthn_plugin_free_public_key_response(
    pbOpSignPubKey: *mut BCRYPT_KEY_BLOB
) -> ());
