pub mod client;
pub mod server;

/// Resolve the path to the IPC socket.
pub fn path(name: &str) -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Use a unique IPC pipe //./pipe/xxxxxxxxxxxxxxxxx.app.bitwarden per user.
        // Hashing prevents problems with reserved characters and file length limitations.
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
        use sha2::Digest;
        let home = dirs::home_dir().unwrap();
        let hash = sha2::Sha256::digest(home.as_os_str().as_encoded_bytes());
        let hash_b64 = URL_SAFE_NO_PAD.encode(hash.as_slice());

        format!(r"\\.\pipe\{hash_b64}.app.{name}").into()
    }

    #[cfg(target_os = "macos")]
    {
        // On MacOS builds, we use the Application Support directory.
        // This directory should already exist as it's also used for
        // the application data and other electron caches.
        // On sandboxed App Store builds, this should ensure that
        // the socket is only accessible to the app bundle.
        let config = dirs::config_dir().unwrap();
        config.join("Bitwarden").join(format!("app.{name}"))
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, we use the user's cache directory.
        let home = dirs::cache_dir().unwrap();
        let path_dir = home.join("com.bitwarden.desktop");

        // The chache directory might not exist, so create it
        let _ = std::fs::create_dir_all(&path_dir);
        path_dir.join(format!("app.{name}"))
    }
}
