//! Inter-process communication for native messaging and IPC server/client.

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

/// The paths to where the native messaging files live on flatpak environments.
#[cfg(target_os = "linux")]
pub const FLATPAK_PATHS: [&str; 4] = [
    "org.mozilla.firefox/.mozilla/native-messaging-hosts",
    "com.google.Chrome/config/google-chrome/NativeMessagingHosts",
    "org.chromium.Chromium/config/chromium/NativeMessagingHosts",
    "com.microsoft.Edge/config/microsoft-edge/NativeMessagingHosts",
];

/// The paths to where the native messaging files live on unsandboxed (deb, rpm, appimage)
/// environments.
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

/// The shared App Group container declared in this bundle's Info.plist, if resolvable.
///
/// Reads the group identifier stamped into the Info.plist per build variant and asks the
/// OS for its container, creating it if needed. Returns `None` outside a signed bundle
/// entitled to the group (e.g. an unsigned dev build). Resolving the group at runtime
/// rather than hardcoding it lets a single native binary serve both production and beta
/// without the two channels sharing a socket.
#[cfg(target_os = "macos")]
fn app_group_container() -> Option<std::path::PathBuf> {
    let group_id = desktop_objc::app_group_id()?;
    desktop_objc::app_group_container_path(&group_id).map(std::path::PathBuf::from)
}

/// The main path to the IPC socket.
pub fn path(name: &str) -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Use a unique IPC pipe //./pipe/xxxxxxxxxxxxxxxxx.s.bw per user (s for socket).
        // Hashing prevents problems with reserved characters and file length limitations.
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
        use sha2::Digest;
        let home = dirs::home_dir().expect("Could not find user home directory");
        let hash = sha2::Sha256::digest(home.as_os_str().as_encoded_bytes());
        let hash_b64 = URL_SAFE_NO_PAD.encode(hash.as_slice());

        format!(r"\\.\pipe\{hash_b64}.s.{name}").into()
    }

    #[cfg(target_os = "macos")]
    {
        // Every socket lives in the shared App Group container, sandboxed or not. The
        // autofill extension is always sandboxed and can only reach sockets there, and
        // routing the desktop proxy through the same container keeps a single socket path
        // per channel instead of one per sandbox status. The OS only hands back the
        // container when the process is entitled to the group, so unsigned dev builds fall
        // through to the cache directory below.
        if let Some(container) = app_group_container() {
            if container.exists() {
                return container.join(format!("s.{name}"));
            }
        }
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        // On Linux, and on Mac when no App Group container is available (unsigned dev
        // builds), we use the user's cache directory.
        let home = dirs::cache_dir().expect("Could not find user cache directory");
        let path_dir = home.join("com.bitwarden.desktop");

        // The cache directory might not exist, so create it
        let _ = std::fs::create_dir_all(&path_dir);
        path_dir.join(format!("s.{name}"))
    }
}

/// Paths to the ipc sockets including alternative paths.
/// For flatpak, a path per sandbox is created.
pub fn all_paths(name: &str) -> Vec<std::path::PathBuf> {
    #[cfg(target_os = "linux")]
    {
        use std::env;

        // On Linux, in flatpak, we mount sockets in each app's sandboxed directory.
        let user_home = dirs::home_dir().expect("Could not find user home directory");
        let flatpak_path = user_home.join(".var/app/");
        let flatpak_paths = FLATPAK_PATHS
            .iter()
            .map(|path| flatpak_path.join(path).join(format!(".app.{name}.socket")));
        let mut paths = vec![path(name)];
        paths.extend(flatpak_paths);

        // Additionally, we add the host home directory path, to mount sockets into the unsandboxed
        // apps.
        let username = env::var("USER").unwrap_or_else(|_| "unknown".to_string());
        // The HOME env variable is changed / mapped inside of snap sandbox but we need the host
        // home directory here.
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
