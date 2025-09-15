use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf, sync::Arc};

use anyhow::anyhow;
use bitwarden_russh::ssh_agent;
use homedir::my_home;
use tokio::{net::UnixListener, sync::Mutex};

use crate::ssh_agent::peercred_unix_listener_stream::PeercredUnixListenerStream;

use super::{BitwardenDesktopAgent, SshAgentUIRequest};

/// User can override the default socket path with this env var
const ENV_BITWARDEN_SSH_AUTH_SOCK: &str = "BITWARDEN_SSH_AUTH_SOCK";

const FLATPAK_DATA_DIR: &str = ".var/app/com.bitwarden.desktop/data";

const SOCKFILE_NAME: &str = ".bitwarden-ssh-agent.sock";

impl BitwardenDesktopAgent {
    /// Starts the Bitwarden Desktop SSH Agent server.
    /// # Errors
    /// Will return `Err` if unable to create and set permissions for socket file path or
    /// if unable to bind to the socket path.
    pub fn start_server(
        auth_request_tx: tokio::sync::mpsc::Sender<SshAgentUIRequest>,
        auth_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    ) -> Result<Self, anyhow::Error> {
        let agent_state = BitwardenDesktopAgent::new(auth_request_tx, auth_response_rx);

        let socket_path = get_socket_path()?;

        // if the socket is already present and wasn't cleanly removed during a previous
        // runtime, remove it before beginning anew.
        remove_path(&socket_path)?;

        println!("[SSH Agent Native Module] Starting SSH Agent server {socket_path:?}");

        match UnixListener::bind(socket_path.clone()) {
            Ok(listener) => {
                // Only the current user should be able to access the socket
                set_user_permissions(&socket_path)?;

                let stream = PeercredUnixListenerStream::new(listener);

                let cloned_agent_state = agent_state.clone();
                let cloned_keystore = cloned_agent_state.keystore.clone();
                let cloned_cancellation_token = cloned_agent_state.cancellation_token.clone();

                tokio::spawn(async move {
                    let _ = ssh_agent::serve(
                        stream,
                        cloned_agent_state.clone(),
                        cloned_keystore,
                        cloned_cancellation_token,
                    )
                    .await;

                    cloned_agent_state
                        .is_running
                        .store(false, std::sync::atomic::Ordering::Relaxed);

                    println!("[SSH Agent Native Module] SSH Agent server exited");
                });

                agent_state
                    .is_running
                    .store(true, std::sync::atomic::Ordering::Relaxed);

                println!("[SSH Agent Native Module] SSH Agent is running: {socket_path:?}");
            }
            Err(e) => {
                eprintln!("[SSH Agent Native Module] Error while starting agent server: {e}");
                return Err(e.into());
            }
        }

        Ok(agent_state)
    }
}

// one of the following:
//   - only the env var socket path if it is defined
//   - the $HOME path and our well known extension
fn get_socket_path() -> Result<PathBuf, anyhow::Error> {
    if let Ok(path) = std::env::var(ENV_BITWARDEN_SSH_AUTH_SOCK) {
        Ok(PathBuf::from(path))
    } else {
        println!(
            "[SSH Agent Native Module] {ENV_BITWARDEN_SSH_AUTH_SOCK} not set, using default path"
        );
        get_default_socket_path()
    }
}

fn is_flatpak() -> bool {
    std::env::var("container") == Ok("flatpak".to_string())
}

// use the $HOME directory
fn get_default_socket_path() -> Result<PathBuf, anyhow::Error> {
    let Ok(Some(mut ssh_agent_directory)) = my_home() else {
        println!("[SSH Agent Native Module] Could not determine home directory");
        return Err(anyhow!("Could not determine home directory."));
    };

    if is_flatpak() {
        ssh_agent_directory = ssh_agent_directory.join(FLATPAK_DATA_DIR);
    }

    ssh_agent_directory = ssh_agent_directory.join(SOCKFILE_NAME);

    Ok(ssh_agent_directory)
}

fn set_user_permissions(path: &PathBuf) -> Result<(), anyhow::Error> {
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|e| anyhow!("Could not set socket permissions for {path:?}: {e}"))
}

// try to remove the given path if it exists
fn remove_path(path: &PathBuf) -> Result<(), anyhow::Error> {
    if let Ok(true) = std::fs::exists(path) {
        std::fs::remove_file(path).map_err(|e| anyhow!("Error removing socket {path:?}: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use rand::{distr::Alphanumeric, Rng};

    use super::*;

    #[test]
    fn test_default_socket_path_success() {
        let path = get_default_socket_path().unwrap();
        let expected = PathBuf::from_iter([
            std::env::var("HOME").unwrap(),
            ".bitwarden-ssh-agent.sock".to_string(),
        ]);
        assert_eq!(path, expected);
    }

    fn rand_file_in_temp() -> PathBuf {
        let mut path = std::env::temp_dir();
        let s: String = rand::rng()
            .sample_iter(&Alphanumeric)
            .take(16)
            .map(char::from)
            .collect();
        path.push(s);
        path
    }

    #[test]
    fn test_remove_path_exists_success() {
        let path = rand_file_in_temp();
        fs::write(&path, "").unwrap();
        remove_path(&path).unwrap();

        assert!(!fs::exists(&path).unwrap());
    }

    // the remove_path should not fail if the path does not exist
    #[test]
    fn test_remove_path_not_found_success() {
        let path = rand_file_in_temp();
        remove_path(&path).unwrap();

        assert!(!fs::exists(&path).unwrap());
    }

    #[test]
    fn test_sock_path_file_permissions() {
        let path = rand_file_in_temp();
        fs::write(&path, "").unwrap();

        set_user_permissions(&path).unwrap();

        let metadata = fs::metadata(&path).unwrap();
        let permissions = metadata.permissions().mode();

        assert_eq!(permissions, 0o100_600);

        remove_path(&path).unwrap();
    }
}
