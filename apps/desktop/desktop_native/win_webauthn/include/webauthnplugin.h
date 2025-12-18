// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

#pragma once

#include <winapifamily.h>

#pragma region Desktop Family or OneCore Family
#if WINAPI_FAMILY_PARTITION(WINAPI_PARTITION_APP | WINAPI_PARTITION_SYSTEM)

#ifdef __cplusplus
extern "C" {
#endif

#ifndef WINAPI
#define WINAPI __stdcall
#endif

#ifndef INITGUID
#define INITGUID
#include <guiddef.h>
#undef INITGUID
#else
#include <guiddef.h>
#endif

//+------------------------------------------------------------------------------------------
// APIs.
//-------------------------------------------------------------------------------------------

typedef enum _PLUGIN_AUTHENTICATOR_STATE
{
    AuthenticatorState_Disabled = 0,
    AuthenticatorState_Enabled
} AUTHENTICATOR_STATE;

HRESULT
WINAPI
WebAuthNPluginGetAuthenticatorState(
    _In_ REFCLSID rclsid,
    _Out_ AUTHENTICATOR_STATE* pluginAuthenticatorState
);

//
// Plugin Authenticator API: WebAuthNAddPluginAuthenticator: Add Plugin Authenticator
//

typedef struct _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
    // Authenticator Name
    LPCWSTR pwszAuthenticatorName;

    // Plugin COM ClsId
    REFCLSID rclsid;

    // Plugin RPID (Optional. Required for a nested WebAuthN call originating from a plugin)
    LPCWSTR pwszPluginRpId;

    // Plugin Authenticator Logo for the Light themes. base64 encoded SVG 1.1 (Optional)
    LPCWSTR pwszLightThemeLogoSvg;

    // Plugin Authenticator Logo for the Dark themes. base64 encoded SVG 1.1 (Optional)
    LPCWSTR pwszDarkThemeLogoSvg;

    // CTAP CBOR encoded authenticatorGetInfo
    DWORD cbAuthenticatorInfo;
    _Field_size_bytes_(cbAuthenticatorInfo)
    const BYTE* pbAuthenticatorInfo;

    // List of supported RP IDs (Relying Party IDs). Should be 0/nullptr if all RPs are supported.
    DWORD cSupportedRpIds;
    const LPCWSTR* ppwszSupportedRpIds;

} WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS, *PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS;
typedef const WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS *PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS;

typedef struct _WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE {
    // Plugin operation signing Public Key - Used to sign the request in PCWEBAUTHN_PLUGIN_OPERATION_REQUEST. Refer pluginauthenticator.h.
    DWORD cbOpSignPubKey;
    _Field_size_bytes_(cbOpSignPubKey)
    PBYTE pbOpSignPubKey;

} WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE, *PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE;
typedef const WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE *PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE;

HRESULT
WINAPI
WebAuthNPluginAddAuthenticator(
    _In_ PCWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS pPluginAddAuthenticatorOptions,
    _Outptr_result_maybenull_ PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE* ppPluginAddAuthenticatorResponse);

void
WINAPI
WebAuthNPluginFreeAddAuthenticatorResponse(
    _In_opt_ PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE pPluginAddAuthenticatorResponse);

//
// Plugin Authenticator API: WebAuthNRemovePluginAuthenticator: Remove Plugin Authenticator
//

HRESULT
WINAPI
WebAuthNPluginRemoveAuthenticator(
    _In_ REFCLSID rclsid);

//
// Plugin Authenticator API: WebAuthNPluginAuthenticatorUpdateDetails: Update Credential Metadata for Browser AutoFill Scenarios
//

typedef struct _WEBAUTHN_PLUGIN_UPDATE_AUTHENTICATOR_DETAILS {
    // Authenticator Name (Optional)
    LPCWSTR pwszAuthenticatorName;

    // Plugin COM ClsId
    REFCLSID rclsid;

    // New Plugin COM ClsId (Optional)
    REFCLSID rclsidNew;

    // Plugin Authenticator Logo for the Light themes. base64 encoded SVG 1.1 (Optional)
    LPCWSTR pwszLightThemeLogoSvg;

    // Plugin Authenticator Logo for the Dark themes. base64 encoded SVG 1.1 (Optional)
    LPCWSTR pwszDarkThemeLogoSvg;

    // CTAP CBOR encoded authenticatorGetInfo
    DWORD cbAuthenticatorInfo;
    _Field_size_bytes_(cbAuthenticatorInfo)
    const BYTE* pbAuthenticatorInfo;

    // List of supported RP IDs (Relying Party IDs). Should be 0/nullptr if all RPs are supported.
    DWORD cSupportedRpIds;
    const LPCWSTR* ppwszSupportedRpIds;

} WEBAUTHN_PLUGIN_UPDATE_AUTHENTICATOR_DETAILS, *PWEBAUTHN_PLUGIN_UPDATE_AUTHENTICATOR_DETAILS;
typedef const WEBAUTHN_PLUGIN_UPDATE_AUTHENTICATOR_DETAILS *PCWEBAUTHN_PLUGIN_UPDATE_AUTHENTICATOR_DETAILS;

HRESULT
WINAPI
WebAuthNPluginUpdateAuthenticatorDetails(
    _In_ PCWEBAUTHN_PLUGIN_UPDATE_AUTHENTICATOR_DETAILS pPluginUpdateAuthenticatorDetails);

//
// Plugin Authenticator API: WebAuthNPluginAuthenticatorAddCredentials: Add Credential Metadata for Browser AutoFill Scenarios
//

typedef struct _WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS {
    // Size of pbCredentialId.
    DWORD cbCredentialId;

    // Credential Identifier bytes. This field is required.
    _Field_size_bytes_(cbCredentialId)
    const BYTE* pbCredentialId;

    // Identifier for the RP. This field is required.
    LPCWSTR pwszRpId;

    // Contains the friendly name of the Relying Party, such as "Acme Corporation", "Widgets Inc" or "Awesome Site".
    // This field is required.
    LPCWSTR pwszRpName;

    // Identifier for the User. This field is required.
    DWORD cbUserId;

    // User Identifier bytes. This field is required.
    _Field_size_bytes_(cbUserId)
    const BYTE* pbUserId;

    // Contains a detailed name for this account, such as "john.p.smith@example.com".
    LPCWSTR pwszUserName;

    // For User: Contains the friendly name associated with the user account such as "John P. Smith".
    LPCWSTR pwszUserDisplayName;

} WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS, *PWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS;
typedef const WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS *PCWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS;

HRESULT
WINAPI
WebAuthNPluginAuthenticatorAddCredentials(
    _In_ REFCLSID rclsid,
    _In_ DWORD cCredentialDetails,
    _In_reads_(cCredentialDetails) PCWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS pCredentialDetails);

//
// Plugin Authenticator API: WebAuthNPluginAuthenticatorRemoveCredentials: Remove Credential Metadata for Browser AutoFill Scenarios
//

HRESULT
WINAPI
WebAuthNPluginAuthenticatorRemoveCredentials(
    _In_ REFCLSID rclsid,
    _In_ DWORD cCredentialDetails,
    _In_reads_(cCredentialDetails) PCWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS pCredentialDetails);

//
// Plugin Authenticator API: WebAuthNPluginAuthenticatorRemoveCredentials: Remove All Credential Metadata for Browser AutoFill Scenarios
//

HRESULT
WINAPI
WebAuthNPluginAuthenticatorRemoveAllCredentials(
    _In_ REFCLSID rclsid);

//
// Plugin Authenticator API: WebAuthNPluginAuthenticatorGetAllCredentials: Get All Credential Metadata cached for Browser AutoFill Scenarios
//

HRESULT
WINAPI
WebAuthNPluginAuthenticatorGetAllCredentials(
    _In_ REFCLSID rclsid,
    _Out_ DWORD* pcCredentialDetails,
    _Outptr_result_buffer_maybenull_(*pcCredentialDetails) PWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS* ppCredentialDetailsArray);

//
// Plugin Authenticator API: WebAuthNPluginAuthenticatorFreeCredentialDetailsList: Free Credential Metadata cached for Browser AutoFill Scenarios
//

void
WINAPI
WebAuthNPluginAuthenticatorFreeCredentialDetailsArray(
    _In_ DWORD cCredentialDetails,
    _In_reads_(cCredentialDetails) PWEBAUTHN_PLUGIN_CREDENTIAL_DETAILS pCredentialDetailsArray);

//
// Hello UV API for Plugin: WebAuthNPluginPerformUv: Perform Hello UV related operations
//

typedef enum _WEBAUTHN_PLUGIN_PERFORM_UV_OPERATION_TYPE
{
    PerformUserVerification = 1,
    GetUserVerificationCount,
    GetPublicKey
} WEBAUTHN_PLUGIN_PERFORM_UV_OPERATION_TYPE;

typedef struct _WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST {

    // Windows handle of the top-level window displayed by the plugin and currently is in foreground as part of the ongoing webauthn operation.
    HWND hwnd;

    // The webauthn transaction id from the WEBAUTHN_PLUGIN_OPERATION_REQUEST
    REFGUID rguidTransactionId;

    // The username attached to the credential that is in use for this webauthn operation
    LPCWSTR pwszUsername;

    // A text hint displayed on the windows hello prompt
    LPCWSTR pwszDisplayHint;
} WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST, *PWEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST;
typedef const WEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST *PCWEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST;

HRESULT
WINAPI
WebAuthNPluginPerformUserVerification(
    _In_ PCWEBAUTHN_PLUGIN_USER_VERIFICATION_REQUEST pPluginUserVerification,
    _Out_ DWORD* pcbResponse,
    _Outptr_result_bytebuffer_maybenull_(*pcbResponse) PBYTE* ppbResponse);

void
WINAPI
WebAuthNPluginFreeUserVerificationResponse(
    _In_opt_ PBYTE ppbResponse);

HRESULT
WINAPI
WebAuthNPluginGetUserVerificationCount(
    _In_ REFCLSID rclsid,
    _Out_ DWORD* pdwVerificationCount);

HRESULT
WINAPI
WebAuthNPluginGetUserVerificationPublicKey(
    _In_ REFCLSID rclsid,
    _Out_ DWORD* pcbPublicKey,
    _Outptr_result_bytebuffer_(*pcbPublicKey) PBYTE* ppbPublicKey); // Free using WebAuthNPluginFreePublicKeyResponse

HRESULT
WINAPI
WebAuthNPluginGetOperationSigningPublicKey(
    _In_ REFCLSID rclsid,
    _Out_ DWORD* pcbOpSignPubKey,
    _Outptr_result_buffer_maybenull_(*pcbOpSignPubKey) PBYTE* ppbOpSignPubKey); // Free using WebAuthNPluginFreePublicKeyResponse

void WINAPI WebAuthNPluginFreePublicKeyResponse(
    _In_opt_ PBYTE pbOpSignPubKey);

#define WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS_VERSION_1 1
#define WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS_CURRENT_VERSION WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS_VERSION_1
typedef struct _WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS {
    //Version of this structure, to allow for modifications in the future.
    DWORD dwVersion;

    // Following have following values:
    //  +1 - TRUE
    //   0 - Not defined
    //  -1 - FALSE
    //up: "true" | "false"
    LONG lUp;
    //uv: "true" | "false"
    LONG lUv;
    //rk: "true" | "false"
    LONG lRequireResidentKey;
} WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS, *PWEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS;
typedef const WEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS *PCWEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS;

#define WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY_VERSION_1 1
#define WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY_CURRENT_VERSION WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY_VERSION_1
typedef struct _WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY {
    //Version of this structure, to allow for modifications in the future.
    DWORD dwVersion;

    // Key type
    LONG lKty;

    // Hash Algorithm: ES256, ES384, ES512
    LONG lAlg;

    // Curve
    LONG lCrv;

    //Size of "x" (X Coordinate)
    DWORD cbX;

    //"x" (X Coordinate) data. Big Endian.
    PBYTE pbX;

    //Size of "y" (Y Coordinate)
    DWORD cbY;

    //"y" (Y Coordinate) data. Big Endian.
    PBYTE pbY;
} WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY, *PWEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY;
typedef const WEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY *PCWEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY;

#define WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION_VERSION_1 1
#define WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION_CURRENT_VERSION WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION_VERSION_1
typedef struct _WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION {
    //Version of this structure, to allow for modifications in the future.
    DWORD dwVersion;

    // Platform's key agreement public key
    PWEBAUTHN_CTAPCBOR_ECC_PUBLIC_KEY pKeyAgreement;

    DWORD cbEncryptedSalt;
    PBYTE pbEncryptedSalt;

    DWORD cbSaltAuth;
    PBYTE pbSaltAuth;
} WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION, *PWEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION;
typedef const WEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION *PCWEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION;

#define WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST_VERSION_1 1
#define WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST_CURRENT_VERSION WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST_VERSION_1
typedef struct _WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST {
    //Version of this structure, to allow for modifications in the future.
    DWORD dwVersion;
    
    //Input RP ID. Raw UTF8 bytes before conversion.
    //These are the bytes to be hashed in the Authenticator Data.
    DWORD cbRpId;
    PBYTE pbRpId;
    
    //Client Data Hash
    DWORD cbClientDataHash;
    PBYTE pbClientDataHash;
    
    //RP Information
    PCWEBAUTHN_RP_ENTITY_INFORMATION pRpInformation;
    
    //User Information
    PCWEBAUTHN_USER_ENTITY_INFORMATION pUserInformation;
    
    // Crypto Parameters
    WEBAUTHN_COSE_CREDENTIAL_PARAMETERS WebAuthNCredentialParameters;
    
    //Credentials used for exclusion
    WEBAUTHN_CREDENTIAL_LIST CredentialList;
    
    //Optional extensions to parse when performing the operation.
    DWORD cbCborExtensionsMap;
    PBYTE pbCborExtensionsMap;
    
    // Authenticator Options (Optional)
    PWEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS pAuthenticatorOptions;
    
    // Pin Auth (Optional)
    BOOL fEmptyPinAuth; // Zero length PinAuth is included in the request
    DWORD cbPinAuth;
    PBYTE pbPinAuth;
    
    //"hmac-secret": true extension
    LONG lHmacSecretExt;

    // "hmac-secret-mc" extension
    PWEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION pHmacSecretMcExtension;

    //"prf" extension
    LONG lPrfExt;
    DWORD cbHmacSecretSaltValues;
    PBYTE pbHmacSecretSaltValues;

    //"credProtect" extension. Nonzero if present
    DWORD dwCredProtect;

    // Nonzero if present
    DWORD dwPinProtocol;

    // Nonzero if present
    DWORD dwEnterpriseAttestation;

    //"credBlob" extension. Nonzero if present
    DWORD cbCredBlobExt;
    PBYTE pbCredBlobExt;

    //"largeBlobKey": true extension
    LONG lLargeBlobKeyExt;

    //"largeBlob": extension
    DWORD dwLargeBlobSupport;

    //"minPinLength": true extension
    LONG lMinPinLengthExt;

    // "json" extension. Nonzero if present
    DWORD cbJsonExt;
    PBYTE pbJsonExt;
} WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST, *PWEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST;
typedef const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST *PCWEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST;

_Success_(return == S_OK)
HRESULT
WINAPI
WebAuthNEncodeMakeCredentialResponse(
    _In_ PCWEBAUTHN_CREDENTIAL_ATTESTATION pCredentialAttestation,
    _Out_ DWORD* pcbResp,
    _Outptr_result_buffer_maybenull_(*pcbResp) BYTE** ppbResp
    );

_Success_(return == S_OK)
HRESULT
WINAPI
WebAuthNDecodeMakeCredentialRequest(
    _In_ DWORD cbEncoded,
    _In_reads_bytes_(cbEncoded) const BYTE* pbEncoded,
    _Outptr_ PWEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST* ppMakeCredentialRequest
    );

void
WINAPI
WebAuthNFreeDecodedMakeCredentialRequest(
    _In_opt_ PWEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST pMakeCredentialRequest
    );

#define WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST_VERSION_1 1
#define WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST_CURRENT_VERSION WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST_VERSION_1
typedef struct _WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST {
    //Version of this structure, to allow for modifications in the future.
    DWORD dwVersion;
    
    //RP ID. After UTF8 to Unicode conversion,
    PCWSTR pwszRpId;
    
    //Input RP ID. Raw UTF8 bytes before conversion.
    //These are the bytes to be hashed in the Authenticator Data.
    DWORD cbRpId;
    PBYTE pbRpId;
    
    //Client Data Hash
    DWORD cbClientDataHash;
    PBYTE pbClientDataHash;
    
    //Credentials used for inclusion
    WEBAUTHN_CREDENTIAL_LIST CredentialList;
    
    //Optional extensions to parse when performing the operation.
    DWORD cbCborExtensionsMap;
    PBYTE pbCborExtensionsMap;
    
    // Authenticator Options (Optional)
    PWEBAUTHN_CTAPCBOR_AUTHENTICATOR_OPTIONS pAuthenticatorOptions;
    
    // Pin Auth (Optional)
    BOOL fEmptyPinAuth; // Zero length PinAuth is included in the request
    DWORD cbPinAuth;
    PBYTE pbPinAuth;
    
    // HMAC Salt Extension (Optional)
    PWEBAUTHN_CTAPCBOR_HMAC_SALT_EXTENSION pHmacSaltExtension;

    // PRF Extension
    DWORD cbHmacSecretSaltValues;
    PBYTE pbHmacSecretSaltValues;

    DWORD dwPinProtocol;

    //"credBlob": true  extension
    LONG lCredBlobExt;

    //"largeBlobKey": true extension
    LONG lLargeBlobKeyExt;

    //"largeBlob" extension
    DWORD dwCredLargeBlobOperation;
    DWORD cbCredLargeBlobCompressed;
    PBYTE pbCredLargeBlobCompressed;
    DWORD dwCredLargeBlobOriginalSize;

    // "json" extension. Nonzero if present
    DWORD cbJsonExt;
    PBYTE pbJsonExt;
} WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST, *PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST;
typedef const WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST *PCWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST;

_Success_(return == S_OK)
HRESULT
WINAPI
WebAuthNDecodeGetAssertionRequest(
    _In_ DWORD cbEncoded,
    _In_reads_bytes_(cbEncoded) const BYTE* pbEncoded,
    _Outptr_ PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST* ppGetAssertionRequest
    );

void
WINAPI
WebAuthNFreeDecodedGetAssertionRequest(
    _In_opt_ PWEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST pGetAssertionRequest
    );

typedef struct _WEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE {
    // [1] credential (optional)
    // [2] authenticatorData
    // [3] signature
    WEBAUTHN_ASSERTION                      WebAuthNAssertion;
    
    // [4] user (optional)
    PCWEBAUTHN_USER_ENTITY_INFORMATION      pUserInformation;
    
    // [5] numberOfCredentials (optional)
    DWORD                                   dwNumberOfCredentials;
    
    // [6] userSelected (optional)
    LONG                                    lUserSelected;
    
    // [7] largeBlobKey (optional)
    DWORD                                   cbLargeBlobKey;
    PBYTE                                   pbLargeBlobKey;
    
    // [8] unsignedExtensionOutputs
    DWORD                                   cbUnsignedExtensionOutputs;
    PBYTE                                   pbUnsignedExtensionOutputs;
} WEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE, *PWEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE;
typedef const WEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE *PCWEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE;

_Success_(return == S_OK)
HRESULT
WINAPI
WebAuthNEncodeGetAssertionResponse(
    _In_ PCWEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE pGetAssertionResponse,
    _Out_ DWORD* pcbResp,
    _Outptr_result_buffer_maybenull_(*pcbResp) BYTE** ppbResp
    );

typedef void (CALLBACK* WEBAUTHN_PLUGIN_STATUS_CHANGE_CALLBACK )(void* context);

HRESULT
WINAPI
WebAuthNPluginRegisterStatusChangeCallback(
    _In_ WEBAUTHN_PLUGIN_STATUS_CHANGE_CALLBACK callback,
    _In_ void* context,
    _In_ REFCLSID rclsid,
    _Out_ DWORD* pdwRegister
    );

HRESULT
WINAPI
WebAuthNPluginUnregisterStatusChangeCallback(
    _In_ DWORD* pdwRegister
    );


#ifdef __cplusplus
}       // Balance extern "C" above
#endif

#endif // WINAPI_FAMILY_PARTITION
#pragma endregion


