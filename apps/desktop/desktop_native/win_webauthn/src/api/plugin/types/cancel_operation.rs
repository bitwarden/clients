use windows::core::GUID;

use crate::{
    api::{
        plugin::{crypto::OwnedRequestHash, SignedRequest},
        sys::plugin::WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    },
    ErrorKind, WinWebAuthnError,
};

pub struct PluginCancelOperationRequest<'a> {
    inner: &'a WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    /// Request hash of the _original_ operation this cancel request is referring to.
    request_hash: OwnedRequestHash,
}

impl<'a> PluginCancelOperationRequest<'a> {
    /// Request transaction ID
    pub fn transaction_id(&self) -> GUID {
        // SAFETY: The pointer is received from Windows, so we assume it's correct.
        unsafe { self.inner.transactionId }
    }

    /// The SHA-256 hash of the original plugin operation request.
    /// Can be used along with the transaction ID to correlate the original cancellation request.
    pub fn operation_request_hash(&self) -> &[u8] {
        &self.request_hash.0
    }

    pub(in crate::api::plugin) fn from_ref(
        value: &'a WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
        request_hash: OwnedRequestHash,
    ) -> Self {
        Self {
            inner: value,
            request_hash,
        }
    }
}

impl SignedRequest for &WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST {
    fn get_signature_parts(&self) -> (u32, *const u8) {
        (self.cbRequestSignature, self.pbRequestSignature)
    }
}
