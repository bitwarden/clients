use crate::agent::BitwardenDesktopAgent;

#[cfg(any(target_os = "linux", target_os = "macos"))]
const SSH_AGENT_SOCK_NAME: &str = ".bitwarden-ssh-agent.sock";
#[cfg(target_os = "linux")]
const FLATPAK_SSH_AGENT_SOCK_NAME: &str =
    ".var/app/com.bitwarden.desktop/data/.bitwarden-ssh-agent.sock";
#[cfg(target_os = "windows")]
const WINDOWS_NAMED_PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";

pub struct PlatformListener {}

impl PlatformListener {
    #[cfg(target_os = "linux")]
    pub fn spawn_listeners(agent: BitwardenDesktopAgent) -> Result<(), anyhow::Error> {
        use crate::transport::unix_listener_stream::UnixListenerStream;
        use homedir::my_home;
        let ssh_agent_directory = if let Ok(Some(home)) = my_home() {
            home
        } else {
            return Err(anyhow::anyhow!("Could not determine home directory"));
        };

        let is_flatpak = std::env::var("container") == Ok("flatpak".to_string());
        let path = if !is_flatpak {
            ssh_agent_directory
                .join(SSH_AGENT_SOCK_NAME)
                .to_str()
                .expect("Path should be valid")
                .to_owned()
        } else {
            ssh_agent_directory
                .join(FLATPAK_SSH_AGENT_SOCK_NAME)
                .to_str()
                .expect("Path should be valid")
                .to_owned()
        };

        tokio::spawn(UnixListenerStream::listen(path, agent));
        Ok(())
    }

    #[cfg(target_os = "macos")]
    pub fn spawn_listeners(agent: BitwardenDesktopAgent) -> Result<(), anyhow::Error> {
        use crate::transport::unix_listener_stream::UnixListenerStream;
        use homedir::my_home;
        let ssh_agent_directory = if let Ok(Some(home)) = my_home() {
            home
        } else {
            return Err(anyhow::anyhow!("Could not determine home directory"));
        };

        let path = ssh_agent_directory
            .join(SSH_AGENT_SOCK_NAME)
            .to_str()
            .expect("Path should be valid")
            .to_owned();

        tokio::spawn(UnixListenerStream::listen(path, agent));
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub fn spawn_listeners(agent: BitwardenDesktopAgent) -> Result<(), anyhow::Error> {
        use crate::transport::named_pipe_listener_stream::NamedPipeServerStream;
        tokio::spawn(async move {
            // Windows by default uses the named pipe \\.\pipe\openssh-ssh-agent. It also supports external SSH auth sock variables, which are
            // not supported here. Windows also supports putty (not implemented here) and unix sockets for WSL (not implemented here).
            tokio::spawn(NamedPipeServerStream::listen(
                WINDOWS_NAMED_PIPE_NAME.to_string(),
                agent,
            ));
        });
        Ok(())
    }
}
