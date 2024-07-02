pub mod client;
pub mod server;

// TODO: We probably can find a better location for the IPC socket on Mac.
// One idea is to use App Groups if we have the entitlement:
// https://developer.apple.com/documentation/xcode/configuring-app-groups
// Then we can write the socket to  /Users/<user>/Library/Group Containers/group.com.bitwarden.<our group name>/ipc.sock
// We might also be able to write to the Apps Container directory from the proxy binary:
// /Users/<user>/Library/Containers/com.bitwarden.desktop/Data

/// Resolve the path to the IPC socket.
pub fn path(name: &str) -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap();

    if cfg!(windows) {
        // Use a unique IPC pipe //./pipe/bitwarden.xxxxxxxxxxxxxxxxx.sock per user.
        // Hashing prevents problems with reserved characters and file length limitations.
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
        use sha2::Digest;
        let hash = sha2::Sha256::digest(home.as_os_str().as_encoded_bytes());
        let hash_b64 = URL_SAFE_NO_PAD.encode(hash.as_slice());

        format!(r"\\.\pipe\{hash_b64}app.{name}").into()
    } else {
        home.join("tmp").join(format!("app.{name}"))
    }
}
