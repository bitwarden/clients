//! Alternative clipboard-set path for GNOME under Flatpak, using XDG Desktop Portals.
//!
//! On GNOME/Wayland inside a Flatpak sandbox the direct `arboard` data-control path can be
//! unreliable, so this module offers the clipboard contents through the
//! [`Clipboard`](ashpd::desktop::clipboard::Clipboard) portal. The Clipboard portal does not
//! own a session of its own; it attaches to an existing portal session. We start an
//! [`InputCapture`](ashpd::desktop::input_capture::InputCapture) session (which implements
//! [`IsClipboardSession`](ashpd::desktop::clipboard::IsClipboardSession)) and persist its
//! session handle to disk as the saved token.

use std::io::Write;

use anyhow::{anyhow, Result};
use ashpd::desktop::{
    clipboard::{Clipboard, RequestClipboardOptions, SetSelectionOptions},
    input_capture::{Capabilities, CreateSessionOptions, InputCapture},
};
use futures::StreamExt;
use tracing::{error, info};

/// MIME type advertised and served for the clipboard selection.
const MIME_TEXT: &str = "text/plain;charset=utf-8";

/// File name (under the config dir) used to persist the InputCapture session token.
const TOKEN_FILE: &str = "clipboard_input_capture_token";

/// Whether the portal-based clipboard path should be used instead of `arboard`.
///
/// True only when running inside a Flatpak sandbox on a GNOME desktop. Mirrors the Flatpak
/// detection used elsewhere in the crate (see `ssh_agent::unix`) and reads
/// `XDG_CURRENT_DESKTOP` for the desktop environment.
pub fn should_use_portal() -> bool {
    let is_flatpak = std::env::var("container").as_deref() == Ok("flatpak");
    let is_gnome = std::env::var("XDG_CURRENT_DESKTOP")
        .map(|desktop| desktop.to_ascii_uppercase().contains("GNOME"))
        .unwrap_or(false);
    is_flatpak && is_gnome
}

/// Set the clipboard to `text` via the Clipboard portal over an InputCapture session.
///
/// Starts an InputCapture session, persists its handle as the saved token, claims the
/// clipboard selection, and serves the data when a consumer requests it. The portal model is
/// offer-based: ownership of the selection lasts only while the session is alive, so the
/// caller must keep the returned future running until the paste has been served.
///
/// `password` is accepted for parity with the `arboard` path; the portal exposes no
/// history-exclusion flag (that is a Windows/`arboard` concept), so it does not change the
/// flow here.
///
/// ```no_run
/// # async fn demo() -> anyhow::Result<()> {
/// use desktop_core::clipboard::portal;
/// if portal::should_use_portal() {
///     portal::write_clipboard("hello", false).await?;
/// }
/// # Ok(())
/// # }
/// ```
pub async fn write_clipboard(text: &str, password: bool) -> Result<()> {
    let _ = password;

    let input_capture = InputCapture::new().await?;
    let (session, _capabilities) = input_capture
        .create_session(
            None,
            CreateSessionOptions::default()
                .set_capabilities(Capabilities::Keyboard | Capabilities::Pointer),
        )
        .await?;

    // Persist the session handle as the saved token. `Session` exposes its object-path handle
    // publicly only through its `Debug` representation, so we capture that. Never log the
    // value itself.
    if let Err(err) = save_session_token(&format!("{session:?}")) {
        error!(error = %err, "[ASHPD] Failed to persist input capture session token");
    }

    let clipboard = Clipboard::new().await?;
    clipboard
        .request(&session, RequestClipboardOptions::default())
        .await?;

    // Subscribe before advertising the selection so the transfer request is not missed.
    let mut transfers = clipboard
        .receive_selection_transfer::<InputCapture>()
        .await?;

    clipboard
        .set_selection(
            &session,
            SetSelectionOptions::default().set_mime_types(&[MIME_TEXT]),
        )
        .await?;
    info!("[ASHPD] Clipboard selection set via portal");

    // Serve the first matching transfer request, then return.
    while let Some((_session, mime_type, serial)) = transfers.next().await {
        if mime_type != MIME_TEXT {
            clipboard
                .selection_write_done(&session, serial, false)
                .await?;
            continue;
        }

        let fd = clipboard.selection_write(&session, serial).await?;
        let std_fd: std::os::fd::OwnedFd = fd.into();
        let mut file = std::fs::File::from(std_fd);
        let mut write_result = file.write_all(text.as_bytes());
        if write_result.is_ok() {
            write_result = file.flush();
        }
        drop(file);

        clipboard
            .selection_write_done(&session, serial, write_result.is_ok())
            .await?;
        write_result?;
        return Ok(());
    }

    Err(anyhow!("clipboard selection transfer stream ended"))
}

/// Persist the session token to a plain file under the config dir.
fn save_session_token(token: &str) -> Result<()> {
    let mut path =
        dirs::config_dir().ok_or_else(|| anyhow!("could not resolve config directory"))?;
    path.push("Bitwarden");
    std::fs::create_dir_all(&path)?;
    path.push(TOKEN_FILE);
    std::fs::write(path, token)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_use_portal_reads_env() {
        // Only asserts the function evaluates without panicking; the result depends on the
        // host environment (Flatpak + GNOME).
        let _ = should_use_portal();
    }

    // Requires a live GNOME Wayland portal session; run manually with `--ignored`.
    #[tokio::test]
    #[ignore]
    async fn manual_write_clipboard() {
        write_clipboard("Hello world!", false).await.unwrap();
    }
}
