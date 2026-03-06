#[napi]
pub mod windows_registry {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn create_key(key: String, subkey: String, value: String) -> napi::Result<()> {
        crate::registry::create_key(&key, &subkey, &value)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn delete_key(key: String, subkey: String) -> napi::Result<()> {
        crate::registry::delete_key(&key, &subkey)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
