#[napi]
pub mod clipboards {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn read() -> napi::Result<String> {
        Ok(desktop_core::clipboard::read()?)
    }

    #[napi]
    pub async fn write(text: String, password: bool) -> napi::Result<()> {
        // On GNOME, this falls back to the XDG Clipboard portal when the direct arboard write
        // fails; on every other platform it is a plain arboard write.
        Ok(desktop_core::clipboard::write_async(&text, password).await?)
    }
}
