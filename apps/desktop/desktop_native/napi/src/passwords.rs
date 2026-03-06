#[napi]
pub mod passwords {

    /// The error message returned when a password is not found during retrieval or deletion.
    #[napi]
    pub const PASSWORD_NOT_FOUND: &str = desktop_core::password::PASSWORD_NOT_FOUND;

    /// Fetch the stored password from the keychain.
    /// Throws {@link Error} with message {@link PASSWORD_NOT_FOUND} if the password does not exist.
    #[napi]
    pub async fn get_password(service: String, account: String) -> napi::Result<String> {
        desktop_core::password::get_password(&service, &account)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Save the password to the keychain. Adds an entry if none exists otherwise updates the
    /// existing entry.
    #[napi]
    pub async fn set_password(
        service: String,
        account: String,
        password: String,
    ) -> napi::Result<()> {
        desktop_core::password::set_password(&service, &account, &password)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Delete the stored password from the keychain.
    /// Throws {@link Error} with message {@link PASSWORD_NOT_FOUND} if the password does not exist.
    #[napi]
    pub async fn delete_password(service: String, account: String) -> napi::Result<()> {
        desktop_core::password::delete_password(&service, &account)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Checks if the os secure storage is available
    #[napi]
    pub async fn is_available() -> napi::Result<bool> {
        desktop_core::password::is_available()
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
