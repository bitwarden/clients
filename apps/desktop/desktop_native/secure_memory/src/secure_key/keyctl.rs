use std::{
    sync::mpsc::{self, Receiver, Sender, SyncSender},
    thread::{self, JoinHandle},
};

use linux_keyutils::{Key, KeyError, KeyRing, KeyRingIdentifier};
use tracing::warn;

use super::{crypto::KEY_SIZE, SecureKeyContainer};
use crate::secure_key::crypto::MemoryEncryptionKey;

/// The key is bound to the dedicated worker's thread keyring.
const KEY_RING_IDENTIFIER: KeyRingIdentifier = KeyRingIdentifier::Thread;
/// This is an atomic global counter used to help generate unique key IDs
static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
/// Generates a unique ID for the key in the kernel keyring.
/// SAFETY: This function is safe to call from multiple threads because it uses an atomic counter.
fn make_id() -> String {
    let counter = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    // In case multiple processes are running, include the PID in the key ID.
    let pid = std::process::id();
    format!("bitwarden_desktop_{}_{}", pid, counter)
}

/// A secure key container that uses the Linux kernel keyctl API to store the key.
/// `https://man7.org/linux/man-pages/man1/keyctl.1.html`. The key is possessed by the dedicated
/// worker thread and does not live in the process address space, so it cannot be included in a
/// process memory dump.
///
/// Linux keyrings are attached to task credentials. This container routes all keyring operations
/// through the worker thread that owns the thread keyring.
pub(super) struct KeyctlSecureKeyContainer {
    command_tx: Sender<KeyctlCommand>,
    worker: Option<JoinHandle<()>>,
}

enum KeyctlCommand {
    Read(SyncSender<Result<MemoryEncryptionKey, KeyError>>),
    Shutdown,
}

fn read_key(key: &Key) -> Result<MemoryEncryptionKey, KeyError> {
    let mut buffer = [0u8; KEY_SIZE];
    let result = key.read(&mut buffer).and_then(|length| {
        if length != KEY_SIZE {
            return Err(KeyError::InvalidArguments);
        }

        Ok(MemoryEncryptionKey::from(&buffer))
    });

    // SAFETY: `buffer` is valid for KEY_SIZE bytes and is not used after being zeroed.
    unsafe { memsec::memzero(buffer.as_mut_ptr(), KEY_SIZE) };
    result
}

fn keyctl_worker(
    id: String,
    data: MemoryEncryptionKey,
    init_tx: SyncSender<Result<(), KeyError>>,
    command_rx: Receiver<KeyctlCommand>,
) {
    let key = KeyRing::from_special_id(KEY_RING_IDENTIFIER, true)
        .and_then(|ring| ring.add_key(&id, &data));
    drop(data);

    let Ok(key) = key else {
        let _ = init_tx.send(key.map(|_| ()));
        return;
    };

    if init_tx.send(Ok(())).is_err() {
        let _ = key.invalidate();
        return;
    }

    for command in command_rx {
        match command {
            KeyctlCommand::Read(response_tx) => {
                let _ = response_tx.send(read_key(&key));
            }
            KeyctlCommand::Shutdown => break,
        }
    }

    let _ = key.invalidate();
}

impl SecureKeyContainer for KeyctlSecureKeyContainer {
    fn as_key(&self) -> MemoryEncryptionKey {
        let (response_tx, response_rx) = mpsc::sync_channel(0);
        self.command_tx
            .send(KeyctlCommand::Read(response_tx))
            .expect("keyctl worker should be running");
        response_rx
            .recv()
            .expect("keyctl worker should return the key")
            .expect("keyctl worker should read the key")
    }

    fn from_key(data: MemoryEncryptionKey) -> Self {
        let id = make_id();
        let (init_tx, init_rx) = mpsc::sync_channel(0);
        let (command_tx, command_rx) = mpsc::channel();
        let worker = thread::Builder::new()
            .name(format!("bitwarden-keyctl-{id}"))
            .spawn(move || keyctl_worker(id, data, init_tx, command_rx))
            .expect("should start keyctl worker");

        init_rx
            .recv()
            .expect("keyctl worker should report initialization status")
            .expect("keyctl worker should initialize the key");

        KeyctlSecureKeyContainer {
            command_tx,
            worker: Some(worker),
        }
    }

    fn is_supported() -> bool {
        thread::Builder::new()
            .name("bitwarden-keyctl-support".to_string())
            .spawn(|| KeyRing::from_special_id(KEY_RING_IDENTIFIER, true).is_ok())
            .and_then(|worker| {
                worker
                    .join()
                    .map_err(|_| std::io::Error::other("keyctl support worker panicked"))
            })
            .unwrap_or(false)
    }
}

impl Drop for KeyctlSecureKeyContainer {
    fn drop(&mut self) {
        if self.command_tx.send(KeyctlCommand::Shutdown).is_err() {
            warn!("keyctl worker stopped before receiving the shutdown command");
        }

        if self
            .worker
            .take()
            .is_some_and(|worker| worker.join().is_err())
        {
            warn!("keyctl worker panicked while shutting down");
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;

    #[test]
    fn test_multiple_keys() {
        let key1 = MemoryEncryptionKey::new();
        let key2 = MemoryEncryptionKey::new();
        let container1 = KeyctlSecureKeyContainer::from_key(key1);
        let container2 = KeyctlSecureKeyContainer::from_key(key2);

        // Capture at time 1
        let data_1_1 = container1.as_key();
        let data_2_1 = container2.as_key();
        // Capture at time 2
        let data_1_2 = container1.as_key();
        let data_2_2 = container2.as_key();

        // Same keys should be equal
        assert_eq!(data_1_1.as_ref(), data_1_2.as_ref());
        assert_eq!(data_2_1.as_ref(), data_2_2.as_ref());

        // Different keys should be different
        assert_ne!(data_1_1.as_ref(), data_2_1.as_ref());
        assert_ne!(data_1_2.as_ref(), data_2_2.as_ref());
    }

    #[test]
    fn test_access_from_preexisting_threads() {
        const THREAD_COUNT: usize = 4;

        // Create the caller threads before the container creates its worker and thread keyring.
        // Calls from any of these threads must be routed through the keyring's owning worker.
        let mut callers = Vec::with_capacity(THREAD_COUNT);
        for _ in 0..THREAD_COUNT {
            let (container_tx, container_rx) = mpsc::sync_channel(0);
            let caller = thread::spawn(move || {
                let container: Arc<KeyctlSecureKeyContainer> = container_rx.recv().unwrap();
                container.as_key()
            });
            callers.push((container_tx, caller));
        }

        let key = MemoryEncryptionKey::new();
        let expected = key.as_ref().to_vec();
        let container = Arc::new(KeyctlSecureKeyContainer::from_key(key));

        for (container_tx, _) in &callers {
            container_tx.send(Arc::clone(&container)).unwrap();
        }

        for (_, caller) in callers {
            let actual = caller.join().unwrap();
            assert_eq!(actual.as_ref(), expected);
        }
    }

    #[test]
    fn test_is_supported() {
        assert!(KeyctlSecureKeyContainer::is_supported());
    }
}
