use super::RegisterError;

pub fn register() -> Result<(), RegisterError> {
    windows_plugin_authenticator::register().map_err(|e| match e {
        windows_plugin_authenticator::RegisterError::NotSupported => RegisterError::NotSupported,
        windows_plugin_authenticator::RegisterError::Failed(reason) => {
            RegisterError::Failed(reason)
        }
    })
}
