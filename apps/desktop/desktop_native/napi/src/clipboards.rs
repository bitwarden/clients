#[napi]
pub mod clipboards {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn read() -> napi::Result<String> {
        Ok(desktop_core::clipboard::read()?)
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn write(text: String, password: bool) -> napi::Result<()> {
        Ok(desktop_core::clipboard::write(&text, password)?)
    }
}
