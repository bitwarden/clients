use super::RegisterError;
use crate::passkey_authenticator::passkey_authenticator::PasskeyProviderState;

pub fn register() -> Result<(), RegisterError> {
    windows_plugin_authenticator::register().map_err(|e| match e {
        windows_plugin_authenticator::RegisterError::NotSupported => RegisterError::NotSupported,
        windows_plugin_authenticator::RegisterError::Failed(reason) => {
            RegisterError::Failed(reason)
        }
    })
}

#[allow(clippy::unused_async)]
pub async fn get_state() -> anyhow::Result<PasskeyProviderState> {
    Ok(PasskeyProviderState {
        registered: false,
        enabled: false,
    })
}
