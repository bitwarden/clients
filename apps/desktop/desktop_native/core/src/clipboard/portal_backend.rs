//! Portal based implementation for setting and reading the clipboard.
//!
//! On GNOME/Wayland the direct `arboard` does not work because GNOME does not implement
//! `zwlr_data_control_manager_v1`. This implementation works via the RemoteDesktop
//! portal instead. Essentially, Bitwarden starts a RemoteDesktop session and gets
//! persistent rights to restart it, resulting in a single permission prompt. This
//! is subsequently used to read and write the clipboard.

use std::io::{Read, Write};

use anyhow::{anyhow, Result};
use ashpd::desktop::{
    clipboard::{Clipboard, RequestClipboardOptions, SetSelectionOptions},
    remote_desktop::{DeviceType, RemoteDesktop, SelectDevicesOptions, SelectedDevices},
    PersistMode, Session,
};
use futures::StreamExt;
use tracing::{error, info};

/// MIME type advertised and served for the clipboard selection.
const MIME_TEXT: &str = "text/plain;charset=utf-8";

/// File name (under the config dir) used to persist the RemoteDesktop session restore token.
const TOKEN_FILE: &str = "remote_desktop_portal_token";

/// Whether the portal-based clipboard fallback should be used when the direct `arboard` write
/// fails.
///
/// True on a GNOME desktop, where `arboard` cannot reliably set the clipboard on Wayland. Reads
/// `XDG_CURRENT_DESKTOP` for the desktop environment.
pub(crate) fn should_use_portal() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP")
        .map(|desktop| desktop.to_ascii_uppercase().contains("GNOME"))
        .unwrap_or(false)
}

/// Set the clipboard to `text` via the Clipboard portal over a RemoteDesktop session.
///
/// Starts a RemoteDesktop session (restoring a saved `restore_token` when available so the
/// consent dialog is shown only once), enables clipboard access before starting, claims the
/// clipboard selection, and serves the data when a consumer requests it. The portal model is
/// offer-based: ownership of the selection lasts only while the session is alive, so the
/// caller must keep the returned future running until the paste has been served.
/// ```
pub async fn write_clipboard(text: &str, password: bool) -> Result<()> {
    // The portal does not support setting the password flag / removing the clipboard item from
    // history. This means that the clipboard item will remain in history for this backend.
    let _ = password;

    let remote_desktop = RemoteDesktop::new().await?;
    let clipboard = Clipboard::new().await?;
    let (session, response) = open_session(&remote_desktop, &clipboard).await?;

    // Serve the selection, then always close the session so we do not leave the RemoteDesktop
    // grant (input injection + clipboard) open on the portal.
    let result = serve_selection(&clipboard, &session, &response, text).await;

    if let Err(err) = session.close().await {
        error!(error = %err, "[ASHPD] Failed to close clipboard portal session");
    }

    result
}

/// Read the clipboard text via the Clipboard portal over a RemoteDesktop session.
///
/// Establishes (or restores) the same clipboard-enabled RemoteDesktop session used by
/// [`write_clipboard`], reads the current selection as [`MIME_TEXT`], and closes the session.
pub(crate) async fn read_clipboard() -> Result<String> {
    let remote_desktop = RemoteDesktop::new().await?;
    let clipboard = Clipboard::new().await?;
    let (session, response) = open_session(&remote_desktop, &clipboard).await?;

    let result = read_selection(&clipboard, &session, &response).await;

    if let Err(err) = session.close().await {
        error!(error = %err, "[ASHPD] Failed to close clipboard portal session");
    }

    result
}

/// Open a clipboard-enabled RemoteDesktop session, restoring a saved token when possible and
/// persisting the (possibly new) restore token. The consent dialog shows only on first use.
async fn open_session(
    remote_desktop: &RemoteDesktop,
    clipboard: &Clipboard,
) -> Result<(Session<RemoteDesktop>, SelectedDevices)> {
    // Try to restore a previously saved session so the consent dialog is shown only once. A
    // persisted token can become invalid (revoked, stale from an older implementation, or
    // rejected by the portal), so on failure we discard it and start a fresh session.
    let (session, response) = match load_session_token() {
        Some(token) => match establish_session(remote_desktop, clipboard, Some(&token)).await {
            Ok(established) => established,
            Err(err) => {
                error!(error = %err, "[ASHPD] Restoring clipboard session failed; retrying without saved token");
                let _ = clear_session_token();
                establish_session(remote_desktop, clipboard, None).await?
            }
        },
        None => establish_session(remote_desktop, clipboard, None).await?,
    };

    // Persist the restore token so future runs skip the consent dialog
    if let Some(token) = response.restore_token() {
        if let Err(err) = save_session_token(token) {
            error!(error = %err, "[ASHPD] Failed to persist remote desktop restore token");
        }
    }

    Ok((session, response))
}

async fn serve_selection(
    clipboard: &Clipboard,
    session: &Session<RemoteDesktop>,
    response: &SelectedDevices,
    text: &str,
) -> Result<()> {
    if !response.is_clipboard_enabled() {
        return Err(anyhow!(
            "remote desktop session did not grant clipboard access"
        ));
    }

    // Subscribe before advertising the selection so the transfer request is not missed.
    let transfers = clipboard
        .receive_selection_transfer::<RemoteDesktop>()
        .await?;
    futures::pin_mut!(transfers);

    clipboard
        .set_selection(
            session,
            SetSelectionOptions::default().set_mime_types(&[MIME_TEXT]),
        )
        .await?;
    info!("[ASHPD] Clipboard selection set via portal");

    // Serve the first matching transfer request, then return.
    while let Some((_session, mime_type, serial)) = transfers.next().await {
        if mime_type != MIME_TEXT {
            clipboard
                .selection_write_done(session, serial, false)
                .await?;
            continue;
        }

        let fd = clipboard.selection_write(session, serial).await?;
        let std_fd: std::os::fd::OwnedFd = fd.into();
        let mut file = std::fs::File::from(std_fd);
        let mut write_result = file.write_all(text.as_bytes());
        if write_result.is_ok() {
            write_result = file.flush();
        }
        drop(file);

        clipboard
            .selection_write_done(session, serial, write_result.is_ok())
            .await?;
        write_result?;
        return Ok(());
    }

    Err(anyhow!("clipboard selection transfer stream ended"))
}

/// Read the current clipboard selection as [`MIME_TEXT`].
///
/// The portal returns a file descriptor that the selection owner writes the data to; we read it
/// to EOF and decode it as UTF-8.
async fn read_selection(
    clipboard: &Clipboard,
    session: &Session<RemoteDesktop>,
    response: &SelectedDevices,
) -> Result<String> {
    if !response.is_clipboard_enabled() {
        return Err(anyhow!(
            "remote desktop session did not grant clipboard access"
        ));
    }

    let fd = clipboard.selection_read(session, MIME_TEXT).await?;
    let std_fd: std::os::fd::OwnedFd = fd.into();
    let mut file = std::fs::File::from(std_fd);

    let mut text = String::new();
    file.read_to_string(&mut text)?;
    Ok(text)
}

/// Create a RemoteDesktop session with clipboard access enabled and start it.
///
/// Requests keyboard/pointer devices (required for a RemoteDesktop session) with a persistent
/// `restore_token`, enables clipboard access before starting (the portal requires this ordering),
/// and starts the session — which shows the consent dialog unless `restore_token` restores a
/// previously approved one.
async fn establish_session(
    remote_desktop: &RemoteDesktop,
    clipboard: &Clipboard,
    restore_token: Option<&str>,
) -> Result<(Session<RemoteDesktop>, SelectedDevices)> {
    let session = remote_desktop.create_session(Default::default()).await?;

    // If any step after creating the session fails, close the session before returning the error
    // so we do not leak it on the portal.
    match start_clipboard_session(remote_desktop, clipboard, &session, restore_token).await {
        Ok(response) => Ok((session, response)),
        Err(err) => {
            if let Err(close_err) = session.close().await {
                error!(error = %close_err, "[ASHPD] Failed to close clipboard portal session after setup failure");
            }
            Err(err)
        }
    }
}

/// Configure and start an already-created RemoteDesktop session for clipboard use.
async fn start_clipboard_session(
    remote_desktop: &RemoteDesktop,
    clipboard: &Clipboard,
    session: &Session<RemoteDesktop>,
    restore_token: Option<&str>,
) -> Result<SelectedDevices> {
    remote_desktop
        .select_devices(
            session,
            SelectDevicesOptions::default()
                .set_devices(DeviceType::Keyboard | DeviceType::Pointer)
                .set_persist_mode(PersistMode::ExplicitlyRevoked)
                .set_restore_token(restore_token),
        )
        .await?;

    // Clipboard access must be requested before the session is started.
    clipboard
        .request(session, RequestClipboardOptions::default())
        .await?;

    let response = remote_desktop
        .start(session, None, Default::default())
        .await?
        .response()?;

    Ok(response)
}

/// Persist the session token to a plain file under the config dir.
fn save_session_token(token: &str) -> Result<()> {
    let mut path = token_path()?;
    std::fs::create_dir_all(&path)?;
    path.push(TOKEN_FILE);
    std::fs::write(path, token)?;
    Ok(())
}

/// Load a previously saved session token, returning `None` if it is absent or unreadable.
fn load_session_token() -> Option<String> {
    let mut path = token_path().ok()?;
    path.push(TOKEN_FILE);
    std::fs::read_to_string(path).ok().filter(|t| !t.is_empty())
}

/// Remove a persisted session token, ignoring the case where it is already absent.
fn clear_session_token() -> Result<()> {
    let mut path = token_path()?;
    path.push(TOKEN_FILE);
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.into()),
    }
}

/// Resolve the directory holding the persisted token file.
fn token_path() -> Result<std::path::PathBuf> {
    let mut path =
        dirs::config_dir().ok_or_else(|| anyhow!("could not resolve config directory"))?;
    path.push("Bitwarden");
    Ok(path)
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
        let text = read_clipboard().await.unwrap();
        assert_eq!(text, "Hello world!");
    }
}
