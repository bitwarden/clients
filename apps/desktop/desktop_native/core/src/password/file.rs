//! Plaintext JSON file password storage. `file_secure_storage` feature only.
//!
//! Keeps debug runs from touching the production app's keyring entries.
//! Layout: `{ "<service>": { "<account>": "<password>" } }`.

use std::{
    collections::BTreeMap,
    fs,
    io::{ErrorKind, Write},
    path::Path,
    sync::Mutex,
};

use anyhow::{anyhow, Result};

use crate::password::PASSWORD_NOT_FOUND;

type Store = BTreeMap<String, BTreeMap<String, String>>;

/// Serializes read-modify-write cycles within this process.
static LOCK: Mutex<()> = Mutex::new(());

/// Retrieves a password from the file.
pub fn get_password(path: &Path, service: &str, account: &str) -> Result<String> {
    let _guard = LOCK.lock().map_err(|_| anyhow!("Lock poisoned"))?;

    read(path)?
        .get(service)
        .and_then(|accounts| accounts.get(account))
        .cloned()
        .ok_or_else(|| anyhow!(PASSWORD_NOT_FOUND))
}

/// Stores a password in the file. Overwrites an existing entry.
pub fn set_password(path: &Path, service: &str, account: &str, password: &str) -> Result<()> {
    let _guard = LOCK.lock().map_err(|_| anyhow!("Lock poisoned"))?;

    let mut store = read(path)?;
    store
        .entry(service.to_owned())
        .or_default()
        .insert(account.to_owned(), password.to_owned());

    write(path, &store)
}

/// Deletes a password from the file.
pub fn delete_password(path: &Path, service: &str, account: &str) -> Result<()> {
    let _guard = LOCK.lock().map_err(|_| anyhow!("Lock poisoned"))?;

    let mut store = read(path)?;
    let Some(accounts) = store.get_mut(service) else {
        return Err(anyhow!(PASSWORD_NOT_FOUND));
    };
    if accounts.remove(account).is_none() {
        return Err(anyhow!(PASSWORD_NOT_FOUND));
    }

    // Drop empty services to keep the file tidy.
    if accounts.is_empty() {
        store.remove(service);
    }

    write(path, &store)
}

fn read(path: &Path) -> Result<Store> {
    // Prevent path traversal attacks by rejecting paths containing '..'.
    if path
        .components()
        .any(|c| c == std::path::Component::ParentDir)
    {
        return Err(anyhow!("Invalid input: {}", path.display()));
    }
    match fs::read_to_string(path) {
        Ok(json) => Ok(serde_json::from_str(&json)?),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(Store::new()),
        Err(e) => Err(e.into()),
    }
}

/// Writes to a sibling temp file, then renames, so a crash never leaves a half-written store.
fn write(path: &Path, store: &Store) -> Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }

    let tmp = path.with_extension("tmp");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);

    // Owner-only, like a keyring entry.
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }

    let mut file = options.open(&tmp)?;
    file.write_all(serde_json::to_string_pretty(store)?.as_bytes())?;
    file.sync_all()?;
    fs::rename(&tmp, path)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    /// Unique per test, so tests running in parallel do not share a file.
    fn store_path(test: &str) -> PathBuf {
        let path = std::env::temp_dir()
            .join(format!("bw-password-file-{}", std::process::id()))
            .join(format!("{test}.json"));
        let _ = fs::remove_file(&path);
        path
    }

    fn assert_not_found(result: Result<impl std::fmt::Debug>) {
        assert_eq!(result.unwrap_err().to_string(), PASSWORD_NOT_FOUND);
    }

    #[test]
    fn set_then_get_roundtrips() {
        let path = store_path("roundtrip");

        set_password(&path, "svc", "acc", "secret").unwrap();

        assert_eq!(get_password(&path, "svc", "acc").unwrap(), "secret");
    }

    #[test]
    fn set_overwrites_existing() {
        let path = store_path("overwrite");

        set_password(&path, "svc", "acc", "old").unwrap();
        set_password(&path, "svc", "acc", "new").unwrap();

        assert_eq!(get_password(&path, "svc", "acc").unwrap(), "new");
    }

    #[test]
    fn delete_removes_entry() {
        let path = store_path("delete");

        set_password(&path, "svc", "acc", "secret").unwrap();
        delete_password(&path, "svc", "acc").unwrap();

        assert_not_found(get_password(&path, "svc", "acc"));
    }

    #[test]
    fn missing_entry_is_not_found() {
        let path = store_path("missing");

        assert_not_found(get_password(&path, "svc", "acc"));
        assert_not_found(delete_password(&path, "svc", "acc"));

        set_password(&path, "svc", "acc", "secret").unwrap();
        assert_not_found(get_password(&path, "svc", "other"));
        assert_not_found(delete_password(&path, "svc", "other"));
    }

    #[test]
    fn services_are_isolated() {
        let path = store_path("isolated");

        set_password(&path, "a", "acc", "one").unwrap();
        set_password(&path, "b", "acc", "two").unwrap();

        assert_eq!(get_password(&path, "a", "acc").unwrap(), "one");
        assert_eq!(get_password(&path, "b", "acc").unwrap(), "two");
    }

    #[cfg(unix)]
    #[test]
    fn file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;

        let path = store_path("mode");

        set_password(&path, "svc", "acc", "secret").unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}
