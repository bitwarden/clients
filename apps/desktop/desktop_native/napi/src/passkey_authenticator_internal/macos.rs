use super::RegisterError;
use crate::passkey_authenticator::passkey_authenticator::PasskeyProviderState;

pub fn register() -> Result<(), RegisterError> {
    // The OS registers the autofill extension, so there is nothing to do as long as the app is
    // entitled to act as a credential provider.
    if desktop_core::autofill::has_credential_provider_entitlement() {
        Ok(())
    } else {
        Err(RegisterError::NotSupported)
    }
}

#[allow(clippy::unused_async)]
pub async fn get_state() -> anyhow::Result<PasskeyProviderState> {
    Ok(PasskeyProviderState {
        registered: false,
        enabled: false,
    })
}
