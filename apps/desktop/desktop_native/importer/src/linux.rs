use crate::chromium::{CryptoService, LocalState};
use anyhow::{anyhow, Result};
use homedir::my_home;
use std::path::PathBuf;

mod util;

//
// Public API
//

pub fn get_supported_browsers() -> Vec<String> {
    SUPPORTED_BROWSERS
        .iter()
        .map(|b| b.name.to_string())
        .collect()
}

pub fn get_browser_settings_directory(browser_name: &String) -> Result<PathBuf> {
    let config = find_browser_config(&browser_name);
    if config.is_none() {
        return Err(anyhow!("Unsupported browser: {}", browser_name));
    }
    let config = config.unwrap();

    let path = my_home()
        .map_err(|_| anyhow!("Home directory not found"))?
        .ok_or_else(|| anyhow!("Home directory not found"))?;

    let path = path.join(config.data_dir);
    Ok(path)
}

pub fn get_crypto_service(
    _browser_name: &String,
    _local_state: &LocalState,
) -> Result<Box<dyn CryptoService>> {
    let service = LinuxCryptoService::new(_local_state);
    Ok(Box::new(service))
}

//
// Private
//

// TODO: DRY this up with macOS and Windows

#[derive(Debug)]
struct BrowserConfig {
    name: &'static str,
    data_dir: &'static str,
}

// TODO: It's possible that there might be multiple possible data directories, depending on the installation method (e.g., snap, flatpak, etc.).
const SUPPORTED_BROWSERS: [BrowserConfig; 2] = [
    BrowserConfig {
        name: "Chrome",
        data_dir: ".config/google-chrome",
    },
    BrowserConfig {
        name: "Chromium",
        data_dir: "snap/chromium/common/chromium",
    },
];

const V10_KEY: [u8; 16] = [
    0xfd, 0x62, 0x1f, 0xe5, 0xa2, 0xb4, 0x02, 0x53, 0x9d, 0xfa, 0x14, 0x7c, 0xa9, 0x27, 0x27, 0x78,
];

const V10_IV: [u8; 16] = [0x20; 16];

fn find_browser_config(browser_name: &str) -> Option<&'static BrowserConfig> {
    SUPPORTED_BROWSERS.iter().find(|b| b.name == browser_name)
}

struct LinuxCryptoService {}

impl LinuxCryptoService {
    fn new(_local_state: &LocalState) -> Self {
        Self {}
    }

    fn decrypt_v10(&self, encrypted: &[u8]) -> Result<String> {
        let plaintext = util::decrypt_aes_128_cbc(&V10_KEY, &V10_IV, encrypted)?;
        String::from_utf8(plaintext).map_err(|e| anyhow!("UTF-8 error: {:?}", e))
    }

    fn decrypt_v11(&self, _encrypted: &[u8]) -> Result<String> {
        Err(anyhow!("decrypt_v11 not implemented"))
    }
}

impl CryptoService for LinuxCryptoService {
    fn decrypt_to_string(&mut self, _encrypted: &[u8]) -> Result<String> {
        let (version, password) =
            util::split_encrypted_string_and_validate(_encrypted, &["v10", "v11"])?;

        let result = match version {
            "v10" => self.decrypt_v10(password),
            "v11" => self.decrypt_v11(password),
            _ => Err(anyhow!("Logic error: unreachable code")),
        }?;

        Ok(result)
    }
}
