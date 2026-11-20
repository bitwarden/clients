#[napi]
pub mod passkey_authenticator {
    use crate::passkey_authenticator_internal::RegisterError;

    /// The error message thrown by {@link register} when the passkey plugin is not supported on
    /// this platform or by this build of the app.
    #[napi]
    pub const NOT_SUPPORTED: &str = "Passkey authenticator plugin is not supported";

    /// Registers the app as a plugin authenticator with the OS.
    /// Throws {@link Error} with message {@link NOT_SUPPORTED} if the passkey plugin is not
    /// supported, which callers may ignore. Any other error means registration failed.
    #[napi]
    pub fn register() -> napi::Result<()> {
        crate::passkey_authenticator_internal::register().map_err(|e| match e {
            RegisterError::NotSupported => napi::Error::from_reason(NOT_SUPPORTED),
            RegisterError::Failed(reason) => {
                napi::Error::from_reason(format!("Passkey registration failed: {reason}"))
            }
        })
    }

    /// The app's status as a passkey provider with the OS.
    #[napi(object)]
    pub struct PasskeyProviderState {
        /// Whether the app is registered with the OS as a passkey provider.
        pub registered: bool,
        /// Whether the user has enabled the app as a passkey provider.
        pub enabled: bool,
    }

    /// Gets the app's status as a passkey provider with the OS.
    #[napi]
    pub async fn get_state() -> napi::Result<PasskeyProviderState> {
        crate::passkey_authenticator_internal::get_state()
            .await
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to get passkey provider state: {e:#}"))
            })
    }
}
