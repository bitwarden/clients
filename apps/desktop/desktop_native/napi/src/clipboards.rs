#[napi]
pub mod clipboards {
    #[napi]
    pub async fn read() -> napi::Result<String> {
        Ok(desktop_core::clipboard::read().await?)
    }

    #[napi]
    pub async fn write(text: String, password: bool) -> napi::Result<()> {
        Ok(desktop_core::clipboard::write(&text, password).await?)
    }
}
