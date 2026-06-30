use std::{marker::PhantomData, ptr::NonNull};

use windows::{
    core::{GUID, HRESULT},
    Win32::Foundation::E_INVALIDARG,
};

use crate::{
    api::{plugin::crypto::Signature, sys::plugin::WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST},
    ErrorKind, WinWebAuthnError,
};

pub struct PluginCancelOperationRequest<'a> {
    inner: NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>,
    _phantom: PhantomData<&'a WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>,
}

impl PluginCancelOperationRequest<'_> {
    /// Request transaction ID
    pub fn transaction_id(&self) -> GUID {
        self.as_ref().transactionId
    }

    /// Request signature.
    pub(in crate::api::plugin) fn request_signature(
        &self,
    ) -> Result<Signature<'_>, WinWebAuthnError> {
        let inner = self.as_ref();
        if inner.pbRequestSignature.is_null() {
            return Err(WinWebAuthnError::new(
                ErrorKind::InvalidArguments,
                "cancel request signature buffer pointer is null",
            ));
        } else if !inner.pbRequestSignature.is_aligned() {
            return Err(WinWebAuthnError::new(
                ErrorKind::InvalidArguments,
                "cancel request signature buffer pointer is not aligned",
            ));
        }

        // SAFETY: The signature buffer pointer is non-null and aligned, and Windows provides a
        // buffer of length cbRequestSignature.
        let slice = unsafe {
            std::slice::from_raw_parts(inner.pbRequestSignature, inner.cbRequestSignature as usize)
        };
        Ok(Signature::new(slice))
    }
}

impl AsRef<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST> for PluginCancelOperationRequest<'_> {
    fn as_ref(&self) -> &WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST {
        // SAFETY: Pointer is received from Windows so we assume it is correct.
        unsafe { self.inner.as_ref() }
    }
}

#[doc(hidden)]
impl From<NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>> for PluginCancelOperationRequest<'_> {
    fn from(value: NonNull<WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST>) -> Self {
        Self {
            inner: value,
            _phantom: PhantomData,
        }
    }
}

#[doc(hidden)]
impl TryFrom<*const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST> for PluginCancelOperationRequest<'_> {
    type Error = HRESULT;
    fn try_from(
        value: *const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    ) -> Result<Self, Self::Error> {
        let op_request_ptr = match NonNull::new(value.cast_mut()) {
            Some(p) => p,
            None => {
                tracing::warn!(
                    "CancelOperation called with null request pointer from Windows. Aborting request."
                );
                return Err(E_INVALIDARG);
            }
        };
        if !op_request_ptr.is_aligned() {
            return Err(E_INVALIDARG);
        }
        Ok(Self {
            inner: op_request_ptr,
            _phantom: PhantomData,
        })
    }
}
