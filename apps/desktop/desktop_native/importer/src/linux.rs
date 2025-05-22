use anyhow::{anyhow, Result};

use crate::chromium::{BrowserConfig, CryptoService, LocalState};

mod util;

//
// Public API
//

// TODO: It's possible that there might be multiple possible data directories, depending on the installation method (e.g., snap, flatpak, etc.).
pub const SUPPORTED_BROWSERS: [BrowserConfig; 2] = [
    BrowserConfig {
        name: "Chrome",
        data_dir: ".config/google-chrome",
    },
    BrowserConfig {
        name: "Chromium",
        data_dir: "snap/chromium/common/chromium",
    },
];

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

const V10_KEY: [u8; 16] = [
    0xfd, 0x62, 0x1f, 0xe5, 0xa2, 0xb4, 0x02, 0x53, 0x9d, 0xfa, 0x14, 0x7c, 0xa9, 0x27, 0x27, 0x78,
];
const V10_IV: [u8; 16] = [0x20; 16];

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
