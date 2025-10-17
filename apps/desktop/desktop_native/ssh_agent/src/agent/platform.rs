use crate::agent::BitwardenDesktopAgent;

#[cfg(target_os = "windows")]
use crate::transport::named_pipe_listener_stream::NamedPipeServerStream;
#[cfg(any(target_os = "linux", target_os = "macos"))]
use crate::transport::unix_listener_stream::UnixListenerStream;
#[cfg(any(target_os = "linux", target_os = "macos"))]
use homedir::my_home;
#[cfg(any(target_os = "linux", target_os = "macos"))]
use tracing::info;

pub struct PlatformListener {}

impl PlatformListener {
    /// Spawns all listeners for the current platform. A platform may have a single listener, or multiple.
    pub fn spawn_listeners(agent: BitwardenDesktopAgent) {
        #[cfg(target_os = "linux")]
        {
            Self::spawn_linux_listeners(agent);
        }

        #[cfg(target_os = "macos")]
        {
            Self::spawn_macos_listeners(agent);
        }

        #[cfg(target_os = "windows")]
        {
            Self::spawn_windows_listeners(agent);
        }
    }

    #[cfg(target_os = "linux")]
    fn spawn_linux_listeners(agent: BitwardenDesktopAgent) {
        let ssh_agent_directory = match my_home() {
            Ok(Some(home)) => home,
            _ => {
                info!("Could not determine home directory");
                return;
            }
        };

        let is_flatpak = std::env::var("container") == Ok("flatpak".to_string());
        let path = if !is_flatpak {
            ssh_agent_directory
                .join(".bitwarden-ssh-agent.sock")
                .to_str()
                .expect("Path should be valid")
                .to_owned()
        } else {
            ssh_agent_directory
                .join(".var/app/com.bitwarden.desktop/data/.bitwarden-ssh-agent.sock")
                .to_str()
                .expect("Path should be valid")
                .to_owned()
        };

        tokio::spawn(UnixListenerStream::listen(path, agent));
    }

    #[cfg(target_os = "macos")]
    fn spawn_macos_listeners(agent: BitwardenDesktopAgent) {
        let ssh_agent_directory = match my_home() {
            Ok(Some(home)) => home,
            _ => {
                info!("Could not determine home directory");
                return;
            }
        };

        let path = ssh_agent_directory
            .join(".bitwarden-ssh-agent.sock")
            .to_str()
            .expect("Path should be valid")
            .to_owned();

        tokio::spawn(UnixListenerStream::listen(path, agent));
    }

    #[cfg(target_os = "windows")]
    pub fn spawn_windows_listeners(agent: BitwardenDesktopAgent) {
        tokio::spawn(async move {
            // Windows by default uses the named pipe \\.\pipe\openssh-ssh-agent. It also supports external SSH auth sock variables, which are
            // not supported here. Windows also supports putty (not implemented here) and unix sockets for WSL (not implemented here).
            const PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";
            tokio::spawn(NamedPipeServerStream::listen(PIPE_NAME.to_string(), agent));
        });
    }
}
