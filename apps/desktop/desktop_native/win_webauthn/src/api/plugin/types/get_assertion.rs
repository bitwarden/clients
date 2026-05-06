use std::marker::PhantomData;

use windows::{core::GUID, Win32::Foundation::HWND};

use crate::{
    api::{
        plugin::WebAuthnCtapCborAuthenticatorOptions,
        sys::plugin::{
            webauthn_decode_get_assertion_request, webauthn_free_decoded_get_assertion_request,
            WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST, WEBAUTHN_PLUGIN_OPERATION_REQUEST,
            WEBAUTHN_PLUGIN_REQUEST_TYPE,
        },
        webauthn::CredentialEx,
    },
    ErrorKind, WinWebAuthnError,
};

#[derive(Debug)]
pub struct PluginGetAssertionRequest<'a> {
    inner: *const WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST<'a>,
    pub window_handle: HWND,
    pub transaction_id: GUID,
}

impl<'a> PluginGetAssertionRequest<'a> {
    pub fn rp_id(&self) -> &str {
        let inner = self.as_ref();
        unsafe {
            // SAFETY: we only support platforms where usize >= 32;
            let len = inner.cbRpId as usize;
            let slice = std::slice::from_raw_parts(inner.pbRpId, len);
            // SAFETY: Windows validates that this is valid UTF-8.
            str::from_utf8_unchecked(slice)
        }
    }

    pub fn client_data_hash(&self) -> &[u8] {
        let inner = self.as_ref();
        // SAFETY: Verified by Windows
        unsafe {
            std::slice::from_raw_parts(inner.pbClientDataHash, inner.cbClientDataHash as usize)
        }
    }

    pub fn allow_credentials(&self) -> impl Iterator<Item = CredentialEx<'_>> {
        // SAFETY: When this is constructed from Self::try_from_ptr(), the Windows decode API
        // constructs valid pointers.
        unsafe { self.as_ref().CredentialList.iter() }
    }

    // TODO(PM-30510): Support extensions
    // pub fn extensions(&self) -> Options<Extensions> {}

    pub fn authenticator_options(&self) -> Option<&'a WebAuthnCtapCborAuthenticatorOptions> {
        self.as_ref().pAuthenticatorOptions
    }

    /// # Safety
    /// When calling this method, callers must ensure that the request is valid.
    /// Specifically:
    /// - `pbEncodedRequest` must be non-null and have the length specified in `cbEncodedRequest`.
    /// - `pbEncodedRequest` must point to a valid byte string of a CTAP `GetAssertion` request.
    ///
    /// A request can be considered valid if the signature is verified as coming from the OS.
    pub(super) unsafe fn try_from_ptr(
        value: &'a WEBAUTHN_PLUGIN_OPERATION_REQUEST,
    ) -> Result<PluginGetAssertionRequest<'a>, WinWebAuthnError> {
        if !matches!(value.requestType, WEBAUTHN_PLUGIN_REQUEST_TYPE::CTAP2_CBOR) {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Unknown plugin operation request type",
            ));
        }

        if value.hWnd.is_invalid() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Invalid handle received",
            ));
        }

        let mut assertion_request: *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST =
            std::ptr::null_mut();
        // SAFETY: The caller must ensure that this is valid.
        unsafe {
            webauthn_decode_get_assertion_request(
                value.cbEncodedRequest,
                value.pbEncodedRequest,
                &mut assertion_request,
            )
        }?
        .ok()
        .map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to decode get assertion request",
                err,
            )
        })?;

        Ok(Self {
            // SAFETY: Windows should return a valid decoded assertion request struct.
            inner: assertion_request as *const WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
            window_handle: value.hWnd,
            transaction_id: value.transactionId,
        })
    }
}

impl<'a> AsRef<WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST<'a>> for PluginGetAssertionRequest<'a> {
    fn as_ref(&self) -> &WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST<'a> {
        unsafe { &*self.inner }
    }
}

impl Drop for PluginGetAssertionRequest<'_> {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            // SAFETY: the caller is responsible for ensuring that this pointer
            // is allocated with an allocator corresponding to this free
            // function.
            unsafe {
                if let Err(err) = webauthn_free_decoded_get_assertion_request(
                    self.inner as *mut WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST,
                ) {
                    tracing::error!(%err, "Failed to free decoded get assertion");
                }
            }
        }
    }
}
