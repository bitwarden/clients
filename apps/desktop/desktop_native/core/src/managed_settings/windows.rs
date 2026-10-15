//! Machine policy under `HKEY_LOCAL_MACHINE` wins as a whole value. User policy under
//! `HKEY_CURRENT_USER` is read only when the machine holds none, which matches how macOS resolves a
//! device-scoped and a user-scoped configuration profile. Only `SOFTWARE\Policies` is read,
//! because the signed-in user cannot write it in either hive.

use anyhow::{anyhow, Result};
use windows::Win32::{
    Foundation::ERROR_FILE_NOT_FOUND,
    System::Registry::{
        RegNotifyChangeKeyValue, HKEY, REG_NOTIFY_CHANGE_LAST_SET, REG_NOTIFY_CHANGE_NAME,
    },
};

const POLICY_SUBKEY: &str = r"SOFTWARE\Policies\Bitwarden\Desktop";
const CONTAINER_VALUE: &str = "ManagedSettings";

/// Deepest first. The policy key does not exist until an administrator deploys a policy, and the
/// unprivileged client cannot create it, so the watch registers on the deepest key that exists.
const WATCH_CANDIDATES: [&str; 3] = [
    POLICY_SUBKEY,
    r"SOFTWARE\Policies\Bitwarden",
    r"SOFTWARE\Policies",
];

/// Machine first, so that its value wins.
const HIVES: [Hive; 2] = [Hive::Machine, Hive::User];

#[derive(Clone, Copy, Debug)]
enum Hive {
    Machine,
    User,
}

impl Hive {
    fn root(self) -> &'static windows_registry::Key {
        match self {
            Hive::Machine => windows_registry::LOCAL_MACHINE,
            Hive::User => windows_registry::CURRENT_USER,
        }
    }
}

/// The JSON string representing administrator-managed settings, or `None`.
///
/// An error means the host state is unknown, for example because a policy key exists but cannot
/// be opened, so the caller keeps the last known profile.
pub fn read() -> Result<Option<String>> {
    for hive in HIVES {
        // An error in the machine hive is returned even when the user hive holds a value, because
        // the machine value might take precedence.
        if let Some(value) = read_hive(hive)? {
            return Ok(Some(value));
        }
    }
    Ok(None)
}

fn read_hive(hive: Hive) -> Result<Option<String>> {
    let key = match hive.root().open(POLICY_SUBKEY) {
        Ok(key) => key,
        // A missing policy key means no profile. Any other error, such as access denied, leaves the
        // host state unknown, so it is returned.
        Err(e) if e.code() == ERROR_FILE_NOT_FOUND.to_hresult() => return Ok(None),
        Err(e) => {
            return Err(anyhow!(e).context(format!(r"failed to open {hive:?}\{POLICY_SUBKEY}")))
        }
    };
    // `get_string` fails for an absent value and for a type other than `REG_SZ` or
    // `REG_EXPAND_SZ`; both mean no profile.
    Ok(key.get_string(CONTAINER_VALUE).ok())
}

/// Carries a resolved watch target into the watch thread.
///
/// The whole `Key` moves, not the `HKEY` extracted from it, because `Key::drop` calls
/// `RegCloseKey` and the handle must stay open for as long as the thread watches it.
struct SendKey(windows_registry::Key);

// SAFETY: `Key` is not `Send` only because it wraps a raw `HKEY` pointer. A registry handle is a
// kernel handle that is valid on any thread of the process, and the key is owned by exactly one
// thread at a time.
unsafe impl Send for SendKey {}

/// The deepest existing key among `WATCH_CANDIDATES`, and whether its subtree must be watched
/// because it is an ancestor of the policy key.
fn resolve_watch_target(hive: Hive) -> Result<(SendKey, bool)> {
    for (index, candidate) in WATCH_CANDIDATES.iter().enumerate() {
        if let Ok(key) = hive.root().open(candidate) {
            return Ok((SendKey(key), index > 0));
        }
    }
    Err(anyhow!(
        "no ancestor of the Bitwarden policy key exists in the {hive:?} hive"
    ))
}

/// Signals `tx` whenever the policy key changes in either hive, because a change in either can
/// change the result of `read`. The watch follows the policy key as it and its ancestors are
/// created and deleted.
pub fn watch(tx: tokio::sync::mpsc::Sender<()>) -> Result<()> {
    // Both targets resolve before any thread starts, so a failure leaves nothing running.
    let targets = HIVES
        .into_iter()
        .map(|hive| resolve_watch_target(hive).map(|target| (hive, target)))
        .collect::<Result<Vec<_>>>()?;
    for (hive, target) in targets {
        spawn_watch_thread(hive, target, tx.clone());
    }
    Ok(())
}

fn spawn_watch_thread(hive: Hive, target: (SendKey, bool), tx: tokio::sync::mpsc::Sender<()>) {
    // A dedicated OS thread, because a synchronous `RegNotifyChangeKeyValue` blocks until a change.
    std::thread::spawn(move || {
        let (mut key, mut watch_subtree) = target;
        loop {
            let filter = REG_NOTIFY_CHANGE_NAME | REG_NOTIFY_CHANGE_LAST_SET;
            // SAFETY: `key` owns an open registry handle opened with `KEY_READ`, which includes
            // `KEY_NOTIFY`, and it stays open for the whole call. The call is synchronous, so no
            // event handle is passed.
            let result = unsafe {
                RegNotifyChangeKeyValue(HKEY(key.0.as_raw()), watch_subtree, filter, None, false)
            };
            if !result.is_ok() {
                tracing::error!(
                    ?hive,
                    ?result,
                    "managed settings: RegNotifyChangeKeyValue failed"
                );
                break;
            }
            if tx.blocking_send(()).is_err() {
                // The receiver is gone, so nobody listens for changes any more.
                break;
            }
            // The signalled change may have created or deleted the policy key or an ancestor.
            match resolve_watch_target(hive) {
                Ok((next, subtree)) => (key, watch_subtree) = (next, subtree),
                Err(e) => {
                    tracing::error!(?hive, "managed settings: failed to re-resolve watch: {e}");
                    break;
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_succeeds_on_any_host() {
        assert!(read().is_ok());
    }

    #[test]
    fn resolve_watch_target_finds_an_ancestor() {
        for hive in HIVES {
            assert!(resolve_watch_target(hive).is_ok());
        }
    }

    /// Writes to `HKEY_LOCAL_MACHINE\SOFTWARE\Policies` and `HKEY_CURRENT_USER\SOFTWARE\Policies`,
    /// so it runs only with the `manual_test` feature, from an elevated prompt, on a machine with
    /// no Bitwarden policy deployed. It removes `SOFTWARE\Policies\Bitwarden` from both hives
    /// afterwards.
    #[cfg(feature = "manual_test")]
    mod manual {
        use std::time::Duration;

        use super::*;

        const BITWARDEN_SUBKEY: &str = r"SOFTWARE\Policies\Bitwarden";

        fn write(hive: Hive, value: &str) {
            hive.root()
                .create(POLICY_SUBKEY)
                .unwrap()
                .set_string(CONTAINER_VALUE, value)
                .unwrap();
        }

        fn clean_up() {
            for hive in HIVES {
                let _ = hive.root().remove_tree(BITWARDEN_SUBKEY);
            }
        }

        #[test]
        fn machine_value_wins_over_user_value() {
            clean_up();
            write(Hive::User, r#"{"user":1}"#);
            assert_eq!(read().unwrap().as_deref(), Some(r#"{"user":1}"#));

            write(Hive::Machine, r#"{"machine":1}"#);
            assert_eq!(read().unwrap().as_deref(), Some(r#"{"machine":1}"#));

            Hive::Machine
                .root()
                .open(POLICY_SUBKEY)
                .unwrap()
                .remove_value(CONTAINER_VALUE)
                .unwrap();
            assert_eq!(read().unwrap().as_deref(), Some(r#"{"user":1}"#));
            clean_up();
        }

        #[test]
        fn watch_follows_policy_key_creation_and_deletion() {
            clean_up();
            let (tx, mut rx) = tokio::sync::mpsc::channel(32);
            watch(tx).unwrap();

            let mut expect_signal = |what: &str| {
                let deadline = std::time::Instant::now() + Duration::from_secs(2);
                loop {
                    match rx.try_recv() {
                        Ok(()) => break,
                        Err(_) if std::time::Instant::now() < deadline => {
                            std::thread::sleep(Duration::from_millis(20))
                        }
                        Err(e) => panic!("no signal after {what}: {e}"),
                    }
                }
                // A change can post several signals; drop the rest before the next step.
                std::thread::sleep(Duration::from_millis(200));
                while rx.try_recv().is_ok() {}
            };

            for hive in HIVES {
                write(hive, r#"{"a":1}"#);
                expect_signal("creating the policy key");
                write(hive, r#"{"a":2}"#);
                expect_signal("changing the value");
                hive.root().remove_tree(BITWARDEN_SUBKEY).unwrap();
                expect_signal("deleting the policy key");
            }
            clean_up();
        }
    }
}
