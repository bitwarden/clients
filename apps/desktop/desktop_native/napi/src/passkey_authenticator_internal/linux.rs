use super::RegisterError;
use crate::passkey_authenticator::passkey_authenticator::PasskeyProviderState;

pub fn register() -> Result<(), RegisterError> {
    Err(RegisterError::NotSupported)
}

#[allow(clippy::unused_async)]
pub async fn get_state() -> anyhow::Result<PasskeyProviderState> {
    Ok(PasskeyProviderState {
        registered: false,
        enabled: false,
    })
}
