//! Windows implementation. Reads and watches the `ManagedSettings` value written by an
//! administrator under the Bitwarden Desktop policy key.
//!
//! Only `HKEY_LOCAL_MACHINE` is read. `HKEY_CURRENT_USER` is writable by the signed-in user, so a
//! value sourced from it would not be administrator-forced.

use anyhow::{bail, Result};
use windows::Win32::System::Registry::{
    RegNotifyChangeKeyValue, HKEY, REG_NOTIFY_CHANGE_LAST_SET, REG_NOTIFY_CHANGE_NAME,
};

const POLICY_SUBKEY: &str = r"SOFTWARE\Policies\Bitwarden\Desktop";
const CONTAINER_VALUE: &str = "ManagedSettings";

/// Ancestors of [`POLICY_SUBKEY`], deepest first. The client runs unprivileged and cannot create
/// the policy key itself, so watching only the leaf would miss the administrator's first
/// deployment. `SOFTWARE\Policies` exists on every Windows installation.
const WATCH_CANDIDATES: [&str; 3] = [
    POLICY_SUBKEY,
    r"SOFTWARE\Policies\Bitwarden",
    r"SOFTWARE\Policies",
];

/// Reads the administrator's managed-settings container value, unparsed.
///
/// Returns `Ok(None)` when the host declares no managed settings, which covers three cases. The
/// policy key may not exist, the `ManagedSettings` value may not exist, or the value may exist
/// with a type other than `REG_SZ` or `REG_EXPAND_SZ`. None of these are error conditions, because
/// each one means the host has no usable managed configuration for this client.
pub fn read() -> Result<Option<String>> {
    let Ok(key) = windows_registry::LOCAL_MACHINE.open(POLICY_SUBKEY) else {
        return Ok(None);
    };
    // `get_string` returns `Err` both when the value is absent and when it exists with an
    // unexpected type, so collapsing it into `None` here is deliberate, not an omission.
    Ok(key.get_string(CONTAINER_VALUE).ok())
}

/// Wraps a registry key so it can be moved into the dedicated watcher thread spawned by
/// [`watch`].
///
/// # Safety
/// A `windows_registry::Key` is not `Send` only because it wraps a raw `HKEY` pointer, and the
/// underlying registry handle is process-wide and valid for use from any thread. This wrapper is
/// the only thing that moves a `Key` across the thread boundary, and it is used solely to read
/// the raw handle for `RegNotifyChangeKeyValue`.
struct SendKey(windows_registry::Key);
unsafe impl Send for SendKey {}

/// Opens the deepest existing ancestor of [`POLICY_SUBKEY`] and reports whether that ancestor
/// must be watched as a subtree (it is not the leaf key itself).
fn resolve_watch_target() -> Result<(SendKey, bool)> {
    for (index, candidate) in WATCH_CANDIDATES.iter().enumerate() {
        if let Ok(key) = windows_registry::LOCAL_MACHINE.open(candidate) {
            return Ok((SendKey(key), index > 0));
        }
    }
    // Unreachable in practice: `SOFTWARE\Policies` exists on every Windows installation.
    bail!("no ancestor of the Bitwarden policy key exists in the registry");
}

/// Invokes `tx` whenever the host's managed configuration changes.
///
/// The watch target is resolved once here, on the calling thread, so an outright failure to open
/// any ancestor of [`POLICY_SUBKEY`] is returned from `watch` itself rather than lost inside the
/// spawned thread.
pub fn watch(tx: tokio::sync::mpsc::Sender<()>) -> Result<()> {
    let (mut target, mut watch_subtree) = resolve_watch_target()?;

    // A dedicated OS thread, not a tokio task: `RegNotifyChangeKeyValue` is called synchronously
    // below (`fasynchronous = false`, `hevent = None`), which blocks the calling thread until the
    // key or a watched descendant changes. That is why no event object and no second wait are
    // needed.
    std::thread::spawn(move || loop {
        let hkey = HKEY(target.0.as_raw());
        let filter = REG_NOTIFY_CHANGE_NAME | REG_NOTIFY_CHANGE_LAST_SET;
        let result = unsafe { RegNotifyChangeKeyValue(hkey, watch_subtree, filter, None, false) };
        if !result.is_ok() {
            tracing::error!("RegNotifyChangeKeyValue failed: {result:?}");
            break;
        }

        // `blocking_send` is correct here, and not `send().await`, because this is a plain OS
        // thread with no tokio runtime to await on.
        if tx.blocking_send(()).is_err() {
            break;
        }

        // Re-resolve on every iteration: the leaf key may have just been created or deleted by
        // the change that was just signalled. A change landing between the notification
        // returning and this re-registration is not separately signalled, but the caller re-reads
        // current state on every signal it does receive, so the managed-settings profile still
        // converges.
        match resolve_watch_target() {
            Ok((next_target, next_watch_subtree)) => {
                target = next_target;
                watch_subtree = next_watch_subtree;
            }
            Err(e) => {
                tracing::error!("failed to re-resolve managed settings watch target: {e}");
                break;
            }
        }
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_never_returns_an_error() {
        // This does not assert that the policy key is absent, since a development machine could
        // legitimately have the administrator policy deployed. It asserts the actual contract:
        // absence of the key, absence of the value, and a value of the wrong type all collapse to
        // `Ok(None)` rather than surfacing a registry error, regardless of machine state.
        assert!(read().is_ok());
    }
}
