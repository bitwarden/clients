#[napi]
pub mod windows_registry {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn create_key(key: String, subkey: String, value: String) -> napi::Result<()> {
        Ok(crate::registry::create_key(&key, &subkey, &value)?)
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn delete_key(key: String, subkey: String) -> napi::Result<()> {
        Ok(crate::registry::delete_key(&key, &subkey)?)
    }
}
