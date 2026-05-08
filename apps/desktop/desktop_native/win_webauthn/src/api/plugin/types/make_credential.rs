use std::mem::MaybeUninit;

use windows::{
    core::GUID,
    Win32::{Foundation::HWND, System::Com::CoTaskMemFree},
};

use crate::{
    api::{
        plugin::{crypto::OwnedRequestHash, WebAuthnCtapCborAuthenticatorOptions},
        sys::{
            plugin::{
                webauthn_decode_make_credential_request, webauthn_encode_make_credential_response,
                webauthn_free_decoded_make_credential_request,
                WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST, WEBAUTHN_PLUGIN_OPERATION_REQUEST,
                WEBAUTHN_PLUGIN_REQUEST_TYPE,
            },
            WEBAUTHN_ATTESTATION_DECODE_NONE, WEBAUTHN_CREDENTIAL_ATTESTATION,
            WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8, WEBAUTHN_EXTENSIONS,
        },
        webauthn::{
            CoseCredentialParameter, CoseCredentialParameters, CredentialEx, CtapTransport,
            HmacSecretSalt, RpEntityInformation, UserEntityInformation,
            WebAuthnExtensionMakeCredentialOutput,
        },
        WindowsString,
    },
    ErrorKind, WinWebAuthnError,
};

#[derive(Debug)]
pub struct PluginMakeCredentialRequest<'a> {
    inner: *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST<'a>,
    pub window_handle: HWND,
    pub transaction_id: GUID,
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
        unsafe {
            UserEntityInformation::new(ptr.as_ref().expect("pUserInformation to be non-null"))
        }
    }

    pub fn pub_key_cred_params(&self) -> impl Iterator<Item = CoseCredentialParameter<'_>> {
        // SAFETY: When this is constructed from Self::try_from_ptr(), the Windows decode API
        // constructs valid pointers.
        let inner = unsafe { self.as_ref().WebAuthNCredentialParameters.iter() };
        CoseCredentialParameters { inner }
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
        request: &'a WEBAUTHN_PLUGIN_OPERATION_REQUEST,
    ) -> Result<PluginMakeCredentialRequest<'a>, WinWebAuthnError> {
        if !matches!(
            request.requestType,
            WEBAUTHN_PLUGIN_REQUEST_TYPE::CTAP2_CBOR
        ) {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Unknown plugin operation request type",
            ));
        }

        if request.hWnd.is_invalid() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Invalid handle received",
            ));
        }

        let mut registration_request = MaybeUninit::uninit();
        unsafe {
            webauthn_decode_make_credential_request(
                request.cbEncodedRequest,
                request.pbEncodedRequest,
                registration_request.as_mut_ptr(),
            )
        }?
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

        Ok(Self {
            inner: registration_request as *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
            window_handle: request.hWnd,
            transaction_id: request.transactionId,
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
                if let Err(err) = webauthn_free_decoded_make_credential_request(
                    self.inner as *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
                ) {
                    tracing::error!(%err, "Failed to free decoded make credential request");
                }
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

    // We are not using these attestation type fields from the original C struct yet.
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
        let cbAuthenticatorData = self.authenticator_data.len().try_into().map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::InvalidArguments,
                "Authenticator data is too long; max size is 2^32 bytes.",
                err,
            )
        })?;

        // Get optional attestation statement pointer and length
        let (pbAttestation, cbAttestation) = match self.attestation_statement.as_ref() {
            Some(data) => (
                data.as_ptr(),
                data.len().try_into().map_err(|err| {
                    WinWebAuthnError::with_cause(
                        ErrorKind::InvalidArguments,
                        "Attestation statement is too long; max size is 2^32 bytes.",
                        err,
                    )
                })?,
            ),
            None => (std::ptr::null(), 0),
        };

        // Get optional attestation object pointer and length
        let (pbAttestationObject, cbAttestationObject) = match self.attestation_object.as_ref() {
            Some(data) => (
                data.as_ptr(),
                data.len().try_into().map_err(|err| {
                    WinWebAuthnError::with_cause(
                        ErrorKind::InvalidArguments,
                        "Attestation object is too long; max size is 2^32 bytes.",
                        err,
                    )
                })?,
            ),
            None => (std::ptr::null(), 0),
        };

        // Get optional credential ID pointer and length
        let (pbCredentialId, cbCredentialId) = match self.credential_id.as_ref() {
            Some(data) => (
                data.as_ptr(),
                data.len().try_into().map_err(|err| {
                    WinWebAuthnError::with_cause(
                        ErrorKind::InvalidArguments,
                        "Credential ID is too long; max size is 2^32 bytes.",
                        err,
                    )
                })?,
            ),
            None => (std::ptr::null(), 0),
        };

        // Convert extensions (TODO (PM-30510): implement proper extension conversion)
        let extensions = WEBAUTHN_EXTENSIONS {
            cExtensions: 0,
            pExtensions: std::ptr::null(),
        };

        // Convert used transport enum to bitmask
        let dwUsedTransport = self.used_transport as u32;

        // Get optional unsigned extension outputs pointer and length
        let (pbUnsignedExtensionOutputs, cbUnsignedExtensionOutputs) =
            match self.unsigned_extension_outputs.as_ref() {
                Some(data) => (
                    data.as_ptr(),
                    data.len().try_into().map_err(|err| {
                        WinWebAuthnError::with_cause(
                            ErrorKind::InvalidArguments,
                            "Unsigned extension output is too long; max size is 2^32 bytes.",
                            err,
                        )
                    })?,
                ),
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
            Some(data) => (
                data.as_ptr(),
                data.len().try_into().map_err(|err| {
                    WinWebAuthnError::with_cause(
                        ErrorKind::InvalidArguments,
                        "Unsigned extension output is too long; max size is 2^32 bytes.",
                        err,
                    )
                })?,
            ),
            None => (std::ptr::null(), 0),
        };

        // Get optional registration response JSON pointer and length
        let (pbRegistrationResponseJSON, cbRegistrationResponseJSON) =
            match self.registration_response_json.as_ref() {
                Some(data) => (
                    data.as_ptr(),
                    data.len().try_into().map_err(|err| {
                        WinWebAuthnError::with_cause(
                            ErrorKind::InvalidArguments,
                            "registration response JSON is too long; max size is 2^32 bytes.",
                            err,
                        )
                    })?,
                ),
                None => (std::ptr::null(), 0),
            };

        let attestation = WEBAUTHN_CREDENTIAL_ATTESTATION {
            // Use version 8 to include all fields
            dwVersion: WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8,
            pwszFormatType,
            cbAuthenticatorData,
            pbAuthenticatorData,
            cbAttestation,
            pbAttestation,
            // TODO: Support attestation.
            dwAttestationDecodeType: WEBAUTHN_ATTESTATION_DECODE_NONE,
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
