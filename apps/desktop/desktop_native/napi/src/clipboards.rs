#[napi]
pub mod clipboards {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn read() -> napi::Result<String> {
        Ok(desktop_core::clipboard::read()?)
    }

    // On non-Linux targets the portal branch is compiled out, leaving no `.await`.
    #[cfg_attr(not(target_os = "linux"), allow(clippy::unused_async))]
    #[napi]
    pub async fn write(text: String, password: bool) -> napi::Result<()> {
        // On GNOME under Flatpak, prefer the XDG Clipboard portal over arboard.
        #[cfg(target_os = "linux")]
        if desktop_core::clipboard::portal::should_use_portal() {
            return Ok(desktop_core::clipboard::portal::write_clipboard(&text, password).await?);
        }

        Ok(desktop_core::clipboard::write(&text, password)?)
    }
}
