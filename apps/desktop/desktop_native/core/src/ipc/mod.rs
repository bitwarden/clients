use std::vec;

use tokio::io::{AsyncRead, AsyncWrite};
use tokio_util::codec::{Framed, LengthDelimitedCodec};

pub mod client;
pub mod server;

/// The maximum size of a message that can be sent over IPC.
/// According to the documentation, the maximum size sent to the browser is 1MB.
/// While the maximum size sent from the browser to the native messaging host is 4GB.
///
/// Currently we are setting the maximum both ways to be 1MB.
///
/// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging#app_side
/// https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-protocol
pub const NATIVE_MESSAGING_BUFFER_SIZE: usize = 1024 * 1024;

/// The maximum number of messages that can be buffered in a channel.
/// This number is more or less arbitrary and can be adjusted as needed,
/// but ideally the messages should be processed as quickly as possible.
pub const MESSAGE_CHANNEL_BUFFER: usize = 32;

#[cfg(target_os = "linux")]
pub const FLATPAK_PATHS: [&str; 4] = [
    "org.mozilla.firefox/.mozilla/native-messaging-hosts",
    "com.google.Chrome/config/google-chrome/NativeMessagingHosts",
    "org.chromium.Chromium/config/chromium/NativeMessagingHosts",
    "com.microsoft.Edge/config/microsoft-edge/NativeMessagingHosts",
];

#[cfg(target_os = "linux")]
pub const UNSANDBOXED_PATHS: [&str; 4] = [
    ".config/chromium/NativeMessagingHosts",
    ".config/google-chrome/NativeMessagingHosts",
    ".config/microsoft-edge/NativeMessagingHosts",
    ".mozilla/native-messaging-hosts",
];

/// This is the codec used for communication through the UNIX socket / Windows named pipe.
/// It's an internal implementation detail, but we want to make sure that both the client
///  and the server use the same one.
fn internal_ipc_codec<T: AsyncRead + AsyncWrite>(inner: T) -> Framed<T, LengthDelimitedCodec> {
    LengthDelimitedCodec::builder()
        .max_frame_length(NATIVE_MESSAGING_BUFFER_SIZE)
        .native_endian()
        .new_framed(inner)
}

/// The main path to the IPC socket.
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
        // When running in an unsandboxed environment, path is: /Users/<user>/
        // While running sandboxed, it's different: /Users/<user>/Library/Containers/com.bitwarden.desktop/Data
        let mut home = dirs::home_dir().unwrap();

        // Check if the app is sandboxed by looking for the Containers directory
        let containers_position = home
            .components()
            .position(|c| c.as_os_str() == "Containers");

        // If the app is sanboxed, we need to use the App Group directory
        if let Some(position) = containers_position {
            // We want to use App Groups in /Users/<user>/Library/Group Containers/LTZ2PFU5D6.com.bitwarden.desktop,
            // so we need to remove all the components after the user. We can use the previous position to do this.
            while home.components().count() > position - 1 {
                home.pop();
            }

            let tmp = home.join("Library/Group Containers/LTZ2PFU5D6.com.bitwarden.desktop/tmp");

            // The tmp directory might not exist, so create it
            let _ = std::fs::create_dir_all(&tmp);
            return tmp.join(format!("app.{name}"));
        }
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        // On Linux and unsandboxed Mac, we use the user's cache directory.
        let home = dirs::cache_dir().unwrap();
        let path_dir = home.join("com.bitwarden.desktop");

        // The cache directory might not exist, so create it
        let _ = std::fs::create_dir_all(&path_dir);
        path_dir.join(format!("app.{name}"))
    }
}

/// Paths to the ipc sockets including alternative paths.
/// For flatpak, a path per sandbox is created.
pub fn all_paths(name: &str) -> Vec<std::path::PathBuf> {
    #[cfg(target_os = "linux")]
    {
        use std::env;

        // On Linux, in flatpak, we mount sockets in each app's sandboxed directory.
        let user_home = dirs::home_dir().unwrap();
        let flatpak_path = user_home.join(".var/app/");
        let flatpak_paths = FLATPAK_PATHS
            .iter()
            .map(|path| flatpak_path.join(path).join(format!(".app.{name}.socket")));
        let mut paths = vec![path(name)];
        paths.extend(flatpak_paths);

        // Additionally, we add the host home directory path, to mount sockets into the unsandboxed apps.
        let username = env::var("USER").unwrap_or_else(|_| "unknown".to_string());
        // The HOME env variable is changed / mapped inside of snap sandbox but we need the host home directory here.
        let host_home = homedir::home(username.clone()).ok().flatten();
        if let Some(host_home) = host_home {
            // Add the host home directory paths for unsandboxed apps.
            let unsandboxed_paths = UNSANDBOXED_PATHS
                .iter()
                .map(|path| host_home.join(path).join(format!(".app.{name}.socket")));
            paths.extend(unsandboxed_paths);
        }

        paths
    }
    #[cfg(not(target_os = "linux"))]
    {
        vec![path(name)]
    }
}
