#[napi]
pub mod passkey_authenticator {
    #[napi]
    pub fn register() -> napi::Result<()> {
        crate::passkey_authenticator_internal::register().map_err(|e| {
            napi::Error::from_reason(format!("Passkey registration failed - Error: {e} - {e:?}"))
        })
    }
}
