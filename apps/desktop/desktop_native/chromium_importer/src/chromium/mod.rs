use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use dirs;
use hex::decode;
use rusqlite::{params, Connection};

mod platform;

#[cfg(target_os = "windows")]
pub use platform::{
    verify_signature, ADMIN_TO_USER_PIPE_NAME, EXPECTED_SIGNATURE_SHA256_THUMBPRINT,
};

pub(crate) use platform::SUPPORTED_BROWSERS as PLATFORM_SUPPORTED_BROWSERS;

//
// Public API
//

#[derive(Debug)]
pub struct ProfileInfo {
    pub name: String,
    pub folder: String,

    pub account_name: Option<String>,
    pub account_email: Option<String>,
}

#[derive(Debug)]
pub struct Login {
    pub url: String,
    pub username: String,
    pub password: String,
    pub note: String,
}

#[derive(Debug)]
pub struct LoginImportFailure {
    pub url: String,
    pub username: String,
    pub error: String,
}

#[derive(Debug)]
pub enum LoginImportResult {
    Success(Login),
    Failure(LoginImportFailure),
}

pub trait InstalledBrowserRetriever {
    fn get_installed_browsers() -> Result<Vec<String>>;
}

pub struct DefaultInstalledBrowserRetriever {}

impl InstalledBrowserRetriever for DefaultInstalledBrowserRetriever {
    fn get_installed_browsers() -> Result<Vec<String>> {
        let mut browsers = Vec::with_capacity(SUPPORTED_BROWSER_MAP.len());

        for (browser, config) in SUPPORTED_BROWSER_MAP.iter() {
            let data_dir = get_browser_data_dir(config)?;
            if data_dir.exists() {
                browsers.push((*browser).to_string());
            }
        }

        Ok(browsers)
    }
}

pub fn get_available_profiles(browser_name: &String) -> Result<Vec<ProfileInfo>> {
    let (_, local_state) = load_local_state_for_browser(browser_name)?;
    Ok(get_profile_info(&local_state))
}

pub async fn import_logins(
    browser_name: &String,
    profile_id: &String,
) -> Result<Vec<LoginImportResult>> {
    let (data_dir, local_state) = load_local_state_for_browser(browser_name)?;

    let mut crypto_service = platform::get_crypto_service(browser_name, &local_state)
        .map_err(|e| anyhow!("Failed to get crypto service: {}", e))?;

    let local_logins = get_logins(&data_dir, profile_id, "Login Data")
        .map_err(|e| anyhow!("Failed to query logins: {}", e))?;

    // This is not available in all browsers, but there's no harm in trying. If the file doesn't exist we just get an empty vector.
    let account_logins = get_logins(&data_dir, profile_id, "Login Data For Account")
        .map_err(|e| anyhow!("Failed to query logins: {}", e))?;

    // TODO: Do we need a better merge strategy? Maybe ignore duplicates at least?
    // TODO: Should we also ignore an error from one of the two imports? If one is successful and the other fails,
    //       should we still return the successful ones? At the moment it doesn't fail for a missing file, only when
    //       something goes really wrong.
    let all_logins = local_logins
        .into_iter()
        .chain(account_logins.into_iter())
        .collect::<Vec<_>>();

    let results = decrypt_logins(all_logins, &mut crypto_service).await;

    Ok(results)
}

//
// Private
//

#[derive(Debug, Clone, Copy)]
pub(crate) struct BrowserConfig {
    pub name: &'static str,
    pub data_dir: &'static str,
}

pub(crate) static SUPPORTED_BROWSER_MAP: LazyLock<
    std::collections::HashMap<&'static str, &'static BrowserConfig>,
> = LazyLock::new(|| {
    platform::SUPPORTED_BROWSERS
        .iter()
        .map(|b| (b.name, b))
        .collect::<std::collections::HashMap<_, _>>()
});

fn get_browser_data_dir(config: &BrowserConfig) -> Result<PathBuf> {
    let dir = dirs::home_dir()
        .ok_or_else(|| anyhow!("Home directory not found"))?
        .join(config.data_dir);
    Ok(dir)
}

//
// CryptoService
//

#[async_trait]
pub(crate) trait CryptoService: Send {
    async fn decrypt_to_string(&mut self, encrypted: &[u8]) -> Result<String>;
}

#[derive(serde::Deserialize, Clone)]
pub(crate) struct LocalState {
    profile: AllProfiles,
    #[allow(dead_code)]
    os_crypt: Option<OsCrypt>,
}

#[derive(serde::Deserialize, Clone)]
struct AllProfiles {
    info_cache: std::collections::HashMap<String, OneProfile>,
}

#[derive(serde::Deserialize, Clone)]
struct OneProfile {
    name: String,
    gaia_name: Option<String>,
    user_name: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct OsCrypt {
    #[allow(dead_code)]
    encrypted_key: Option<String>,
    #[allow(dead_code)]
    app_bound_encrypted_key: Option<String>,
}

fn load_local_state_for_browser(browser_name: &String) -> Result<(PathBuf, LocalState)> {
    let config = SUPPORTED_BROWSER_MAP
        .get(browser_name.as_str())
        .ok_or_else(|| anyhow!("Unsupported browser: {}", browser_name))?;

    let data_dir = get_browser_data_dir(config)?;
    if !data_dir.exists() {
        return Err(anyhow!(
            "Browser user data directory '{}' not found",
            data_dir.display()
        ));
    }

    let local_state = load_local_state(&data_dir)?;

    Ok((data_dir, local_state))
}

fn load_local_state(browser_dir: &Path) -> Result<LocalState> {
    let local_state = std::fs::read_to_string(browser_dir.join("Local State"))
        .map_err(|e| anyhow!("Failed to read local state file: {}", e))?;

    serde_json::from_str(&local_state)
        .map_err(|e| anyhow!("Failed to parse local state JSON: {}", e))
}

fn get_profile_info(local_state: &LocalState) -> Vec<ProfileInfo> {
    local_state
        .profile
        .info_cache
        .iter()
        .map(|(name, info)| ProfileInfo {
            name: info.name.clone(),
            folder: name.clone(),
            account_name: info.gaia_name.clone(),
            account_email: info.user_name.clone(),
        })
        .collect()
}

struct EncryptedLogin {
    url: String,
    username: String,
    encrypted_password: Vec<u8>,
    encrypted_note: Vec<u8>,
}

fn get_logins(
    browser_dir: &Path,
    profile_id: &String,
    filename: &str,
) -> Result<Vec<EncryptedLogin>> {
    let login_data_path = browser_dir.join(profile_id).join(filename);

    // Sometimes database files are not present, so nothing to import
    if !login_data_path.exists() {
        return Ok(vec![]);
    }

    // When the browser with the current profile is open the database file is locked.
    // To access it we need to copy it to a temporary location.
    let tmp_db_path = std::env::temp_dir().join(format!(
        "tmp-logins-{}-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| anyhow!("Failed to retrieve system time: {}", e))?
            .as_millis(),
        rand::random::<u32>()
    ));

    std::fs::copy(&login_data_path, &tmp_db_path).map_err(|e| {
        anyhow!(
            "Failed to copy the password database file at {:?}: {}",
            login_data_path,
            e
        )
    })?;

    let tmp_db_path = tmp_db_path
        .to_str()
        .ok_or_else(|| anyhow!("Failed to locate database."))?;
    let maybe_logins =
        query_logins(tmp_db_path).map_err(|e| anyhow!("Failed to query logins: {}", e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(tmp_db_path);

    Ok(maybe_logins)
}

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    decode(hex).unwrap_or_default()
}

fn table_exist(conn: &Connection, table_name: &str) -> Result<bool, rusqlite::Error> {
    conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?1")?
        .exists(params![table_name])
}

fn query_logins(db_path: &str) -> Result<Vec<EncryptedLogin>, rusqlite::Error> {
    let conn = Connection::open(db_path)?;

    let have_logins = table_exist(&conn, "logins")?;
    let have_password_notes = table_exist(&conn, "password_notes")?;
    if !have_logins || !have_password_notes {
        return Ok(vec![]);
    }

    let mut stmt = conn.prepare(
        r#"
        SELECT
          l.origin_url          AS url,
          l.username_value      AS username,
          hex(l.password_value) AS encryptedPasswordHex,
          hex(pn.value)         AS encryptedNoteHex
        FROM
          logins l
        LEFT JOIN
          password_notes pn ON l.id = pn.parent_id
        WHERE
          l.blacklisted_by_user = 0
        "#,
    )?;

    let logins_iter = stmt.query_map((), |row| {
        let url: String = row.get("url")?;
        let username: String = row.get("username")?;
        let encrypted_password_hex: String = row.get("encryptedPasswordHex")?;
        let encrypted_note_hex: String = row.get("encryptedNoteHex")?;
        Ok(EncryptedLogin {
            url,
            username,
            encrypted_password: hex_to_bytes(&encrypted_password_hex),
            encrypted_note: hex_to_bytes(&encrypted_note_hex),
        })
    })?;

    let logins = logins_iter.collect::<Result<Vec<_>, _>>()?;

    Ok(logins)
}

async fn decrypt_logins(
    encrypted_logins: Vec<EncryptedLogin>,
    crypto_service: &mut Box<dyn CryptoService>,
) -> Vec<LoginImportResult> {
    let mut results = Vec::with_capacity(encrypted_logins.len());
    for encrypted_login in encrypted_logins {
        let result = decrypt_login(encrypted_login, crypto_service).await;
        results.push(result);
    }
    results
}

async fn decrypt_login(
    encrypted_login: EncryptedLogin,
    crypto_service: &mut Box<dyn CryptoService>,
) -> LoginImportResult {
    let maybe_password = crypto_service
        .decrypt_to_string(&encrypted_login.encrypted_password)
        .await;
    match maybe_password {
        Ok(password) => {
            let note = crypto_service
                .decrypt_to_string(&encrypted_login.encrypted_note)
                .await
                .unwrap_or_default();

            LoginImportResult::Success(Login {
                url: encrypted_login.url,
                username: encrypted_login.username,
                password,
                note,
            })
        }
        Err(e) => LoginImportResult::Failure(LoginImportFailure {
            url: encrypted_login.url,
            username: encrypted_login.username,
            error: e.to_string(),
        }),
    }
}
