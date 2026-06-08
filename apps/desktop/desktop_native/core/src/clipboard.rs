use anyhow::Result;
use arboard::{Clipboard, Set};

// Alternative portal-based clipboard path for GNOME.
#[cfg(target_os = "linux")]
#[path = "clipboard_portal_linux.rs"]
mod portal;

pub(crate) fn read_internal() -> Result<String> {
    let mut clipboard = Clipboard::new()?;

    Ok(clipboard.get_text()?)
}

/// Read the clipboard, using the XDG Desktop Portal on GNOME.
///
/// On GNOME/Wayland `arboard` cannot reliably read the clipboard (GNOME does not implement the
/// `zwlr_data_control_manager_v1` protocol), so on GNOME we read through the [`portal`] (RemoteDesktop +
/// Clipboard). On every other Linux desktop this is just [`read`].
#[cfg(target_os = "linux")]
pub async fn read() -> Result<String> {
    if portal::should_use_portal() {
        return portal::read_clipboard().await;
    }

    read_internal()
}

/// Read the clipboard
#[cfg(not(target_os = "linux"))]
#[allow(clippy::unused_async)]
pub async fn read() -> Result<String> {
    read_internal()
}

pub(crate) fn write_internal(text: &str, hide_from_history: bool) -> Result<()> {
    let mut clipboard = Clipboard::new()?;

    let set = clipboard_set(clipboard.set(), hide_from_history);

    set.text(text)?;
    Ok(())
}

/// Write to the clipboard, using the XDG Desktop Portal on GNOME.
///
/// On GNOME/Wayland `arboard` cannot reliably set the clipboard (GNOME does not implement the
/// `zwlr_data_control_manager_v1` protocol), so on GNOME we always offer the contents through the [`portal`]
/// (RemoteDesktop + Clipboard). On every other Linux desktop this is just [`write_internal`].
#[cfg(target_os = "linux")]
pub async fn write(text: &str, hide_from_history: bool) -> Result<()> {
    if portal::should_use_portal() {
        return portal::write_clipboard(text, hide_from_history).await;
    }

    write_internal(text, hide_from_history)
}

/// Write to the clipboard
/// 
/// Note: `hide_from_history` is best-effort and may be ignored depending on platform support.
#[cfg(not(target_os = "linux"))]
#[allow(clippy::unused_async)]
pub async fn write(text: &str, hide_from_history: bool) -> Result<()> {
    write_internal(text, hide_from_history)
}

// Exclude from windows clipboard history
#[cfg(target_os = "windows")]
fn clipboard_set(set: Set, hide_from_history: bool) -> Set {
    use arboard::SetExtWindows;

    if hide_from_history {
        set.exclude_from_cloud().exclude_from_history()
    } else {
        set
    }
}

// Wait for clipboard to be available on linux
#[cfg(target_os = "linux")]
fn clipboard_set(set: Set, hide_from_history: bool) -> Set {
    use arboard::SetExtLinux;

    if hide_from_history {
        set.exclude_from_history().wait()
    } else {
        set.wait()
    }
}

#[cfg(target_os = "macos")]
fn clipboard_set(set: Set, hide_from_history: bool) -> Set {
    use arboard::SetExtApple;

    if hide_from_history {
        set.exclude_from_history()
    } else {
        set
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(any(feature = "manual_test", not(target_os = "linux")))]
    fn test_write_read() {
        let message = "Hello world!";

        write_internal(message, false).unwrap();
        assert_eq!(message, read_internal().unwrap());
    }
}
