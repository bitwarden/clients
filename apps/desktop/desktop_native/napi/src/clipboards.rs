#[napi]
pub mod clipboards {
    #[napi]
    pub async fn read() -> napi::Result<String> {
        Ok(desktop_core::clipboard::read_async().await?)
    }

    #[napi]
    pub async fn write(text: String, password: bool) -> napi::Result<()> {
        Ok(desktop_core::clipboard::write_async(&text, password).await?)
    }
}
