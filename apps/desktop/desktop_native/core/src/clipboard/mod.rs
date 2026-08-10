use anyhow::Result;

mod arboard_backend;

// Alternative portal-based clipboard path for GNOME.
#[cfg(target_os = "linux")]
mod portal_backend;

/// Read the clipboard
#[allow(clippy::unused_async)]
pub async fn read() -> Result<String> {
    #[cfg(target_os = "linux")]
    if portal_backend::should_use_portal() {
        return portal_backend::read_clipboard().await;
    }

    arboard_backend::read()
}

/// Write to the clipboard
///
/// Note: `hide_from_history` is best-effort and may be ignored depending on platform support.
#[allow(clippy::unused_async)]
pub async fn write(text: &str, hide_from_history: bool) -> Result<()> {
    #[cfg(target_os = "linux")]
    if portal_backend::should_use_portal() {
        return portal_backend::write_clipboard(text, hide_from_history).await;
    }

    arboard_backend::write(text, hide_from_history)
}
