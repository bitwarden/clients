#[napi]
pub mod passkey_authenticator {
    #[napi]
    pub fn register(
        authenticator_name: String,
        clsid: String,
        logo_svg: String,
    ) -> napi::Result<()> {
        crate::passkey_authenticator_internal::register(authenticator_name, &clsid, logo_svg)
            .map_err(|e| napi::Error::from_reason(format!("Passkey registration failed: {e:?}")))
    }
}
