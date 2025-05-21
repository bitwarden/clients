use std::path::PathBuf;

use anyhow::{anyhow, Result};
use hex::decode;
use rusqlite::{params, Connection};

// Platform-specific code
#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod platform;

//
// Public API
//

#[derive(Debug)]
pub struct ProfileInfo {
    pub name: String,
    pub folder: String,

    #[allow(dead_code)]
    pub account_name: Option<String>,

    #[allow(dead_code)]
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

pub fn get_installed_browsers() -> Result<Vec<String>> {
    let supported_browsers = platform::get_supported_browsers();
    let mut browsers = Vec::with_capacity(supported_browsers.len());

    for browser in supported_browsers {
        let browser_dir = platform::get_browser_settings_directory(&browser)
            .map_err(|e| anyhow!("Failed to get browser settings directory: {}", e))?;

        if browser_dir.exists() {
            browsers.push(browser);
        }
    }

    Ok(browsers)
}

pub fn get_available_profiles(browser_name: &String) -> Result<Vec<ProfileInfo>> {
    let browser_dir = platform::get_browser_settings_directory(browser_name)
        .map_err(|e| anyhow!("Failed to get browser settings directory: {}", e))?;

    if !browser_dir.exists() {
        return Err(anyhow!(
            "Browser user data directory '{}' not found",
            browser_dir.display()
        ));
    }

    let local_state =
        load_local_state(&browser_dir).map_err(|e| anyhow!("Failed to load local state: {}", e))?;

    Ok(get_profile_info(&local_state))
}

pub fn import_logins(browser_name: &String, profile_id: &String) -> Result<Vec<LoginImportResult>> {
    let browser_dir = platform::get_browser_settings_directory(browser_name)
        .map_err(|e| anyhow!("Failed to get browser settings directory: {}", e))?;

    let local_state =
        load_local_state(&browser_dir).map_err(|e| anyhow!("Failed to load local state: {}", e))?;

    let mut crypto_service = platform::get_crypto_service(browser_name, &local_state)
        .map_err(|e| anyhow!("Failed to get crypto service: {}", e))?;

    let local_logins = get_logins(&browser_dir, &profile_id, "Login Data")
        .map_err(|e| anyhow!("Failed to query logins: {}", e))?;

    // This is not available in all browsers, but there's no harm in trying. If the file doesn't exist we just get an empty vector.
    let account_logins = get_logins(&browser_dir, &profile_id, "Login Data For Account")
        .map_err(|e| anyhow!("Failed to query logins: {}", e))?;

    // TODO: Do we need a better merge strategy? Maybe ignore duplicates at least?
    // TODO: Should we also ignore an error from one of the two imports? If one is successful and the other fails,
    //       should we still return the successful ones? At the moment it doesn't fail for a missing file, only when
    //       something goes really wrong.
    let all_logins = local_logins
        .into_iter()
        .chain(account_logins.into_iter())
        .collect::<Vec<_>>();

    let results = decrypt_logins(all_logins, &mut crypto_service);

    Ok(results)
}

//
// Private
//

//
// CryptoService
//

trait CryptoService {
    fn decrypt_to_string(&mut self, encrypted: &[u8]) -> Result<String>;
}

#[derive(serde::Deserialize, Clone)]
struct LocalState {
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
}

fn load_local_state(browser_dir: &PathBuf) -> Result<LocalState> {
    let local_state = std::fs::read_to_string(browser_dir.join("Local State"))
        .map_err(|e| anyhow!("Failed to read local state file: {}", e))?;

    serde_json::from_str(&local_state)
        .map_err(|e| anyhow!("Failed to parse local state JSON: {}", e))
}

fn get_profile_info(local_state: &LocalState) -> Vec<ProfileInfo> {
    let mut profile_infos = Vec::new();
    for (name, info) in local_state.profile.info_cache.iter() {
        profile_infos.push(ProfileInfo {
            name: info.name.clone(),
            folder: name.clone(),
            account_name: info.gaia_name.clone(),
            account_email: info.user_name.clone(),
        });
    }
    profile_infos
}

struct EncryptedLogin {
    url: String,
    username: String,
    encrypted_password: Vec<u8>,
    encrypted_note: Vec<u8>,
}

fn get_logins(
    browser_dir: &PathBuf,
    profile_id: &String,
    filename: &str,
) -> Result<Vec<EncryptedLogin>> {
    let login_data_path = browser_dir.join(&profile_id).join(filename);

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
            .unwrap()
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

    let maybe_logins = query_logins(tmp_db_path.to_str().unwrap())
        .map_err(|e| anyhow!("Failed to query logins: {}", e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(tmp_db_path);

    Ok(maybe_logins)
}

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    decode(hex).unwrap_or_default()
}

fn does_table_exist(conn: &Connection, table_name: &str) -> Result<bool, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?1")?;
    let exists = stmt.exists(params![table_name])?;
    Ok(exists)
}

fn query_logins(db_path: &str) -> Result<Vec<EncryptedLogin>, rusqlite::Error> {
    let conn = Connection::open(db_path)?;

    let have_logins = does_table_exist(&conn, "logins")?;
    let have_password_notes = does_table_exist(&conn, "password_notes")?;
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

    let mut logins = Vec::new();
    for login in logins_iter {
        logins.push(login?);
    }

    Ok(logins)
}

fn decrypt_logins(
    encrypted_logins: Vec<EncryptedLogin>,
    crypto_service: &mut Box<dyn CryptoService>,
) -> Vec<LoginImportResult> {
    encrypted_logins
        .into_iter()
        .map(|encrypted_login| decrypt_login(encrypted_login, crypto_service))
        .collect()
}

fn decrypt_login(
    encrypted_login: EncryptedLogin,
    crypto_service: &mut Box<dyn CryptoService>,
) -> LoginImportResult {
    match crypto_service.decrypt_to_string(&encrypted_login.encrypted_password) {
        Ok(password) => {
            let note = crypto_service
                .decrypt_to_string(&encrypted_login.encrypted_note)
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
