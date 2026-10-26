//! Plaintext JSON file password storage. `file_secure_storage` feature only.
//!
//! Keeps debug runs from touching the production app's keyring entries.
//! Layout: `{ "<service>": { "<account>": "<password>" } }`.

use std::{
    collections::BTreeMap,
    fs,
    io::{ErrorKind, Write},
    path::{Component, Path, PathBuf},
    sync::Mutex,
};

use anyhow::{anyhow, Result};

use crate::password::PASSWORD_NOT_FOUND;

/// In-memory copy of the password file, loaded on first use.
/// The mutex serializes read-modify-write cycles within this process.
static STORE: Mutex<Option<Store>> = Mutex::new(None);

/// Retrieves a password from the file.
pub fn get_password(path: &Path, service: &str, account: &str) -> Result<String> {
    with_store(path, |store| store.read(service, account))
}

/// Stores a password in the file. Overwrites an existing entry.
pub fn set_password(path: &Path, service: &str, account: &str, password: &str) -> Result<()> {
    with_store(path, |store| store.write(service, account, password))
}

/// Deletes a password from the file.
pub fn delete_password(path: &Path, service: &str, account: &str) -> Result<()> {
    with_store(path, |store| store.delete(service, account))
}

/// Runs `f` on the locked store, loading it from `path` if not loaded yet or loaded from
/// another path.
fn with_store<T>(path: &Path, f: impl FnOnce(&mut Store) -> Result<T>) -> Result<T> {
    let mut guard = STORE.lock().map_err(|_| anyhow!("Lock poisoned"))?;

    let store = match guard.take() {
        Some(store) if store.path == path => guard.insert(store),
        _ => guard.insert(Store::load(path)?),
    };

    f(store)
}

/// Passwords of one file. Every change is written back to disk.
struct Store {
    path: PathBuf,
    /// service -> account -> password
    services: BTreeMap<String, BTreeMap<String, String>>,
}

impl Store {
    /// Retrieves a password.
    pub fn read(&self, service: &str, account: &str) -> Result<String> {
        self.services
            .get(service)
            .and_then(|accounts| accounts.get(account))
            .cloned()
            .ok_or_else(|| anyhow!(PASSWORD_NOT_FOUND))
    }

    /// Stores a password. Overwrites an existing entry.
    pub fn write(&mut self, service: &str, account: &str, password: &str) -> Result<()> {
        self.services
            .entry(service.to_owned())
            .or_default()
            .insert(account.to_owned(), password.to_owned());

        self.save()
    }

    /// Deletes a password.
    pub fn delete(&mut self, service: &str, account: &str) -> Result<()> {
        let Some(accounts) = self.services.get_mut(service) else {
            return Err(anyhow!(PASSWORD_NOT_FOUND));
        };
        if accounts.remove(account).is_none() {
            return Err(anyhow!(PASSWORD_NOT_FOUND));
        }

        // Drop empty services to keep the file tidy.
        if accounts.is_empty() {
            self.services.remove(service);
        }

        self.save()
    }

    /// Loads the store. A missing file is an empty store.
    fn load(path: &Path) -> Result<Self> {
        // Prevent path traversal attacks by rejecting paths containing '..'.
        if path.components().any(|c| c == Component::ParentDir) {
            return Err(anyhow!("Invalid input: {}", path.display()));
        }

        let services = match fs::read_to_string(path) {
            Ok(json) => serde_json::from_str(&json)?,
            Err(e) if e.kind() == ErrorKind::NotFound => BTreeMap::new(),
            Err(e) => return Err(e.into()),
        };

        Ok(Self {
            path: path.to_owned(),
            services,
        })
    }

    /// Writes to a sibling temp file, then renames, so a crash never leaves a half-written store.
    fn save(&self) -> Result<()> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir)?;
        }

        let tmp = self.path.with_extension("tmp");
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);

        // Owner-only, like a keyring entry.
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }

        let mut file = options.open(&tmp)?;
        file.write_all(serde_json::to_string_pretty(&self.services)?.as_bytes())?;
        file.sync_all()?;
        fs::rename(&tmp, &self.path)?;

        Ok(())
    }
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
