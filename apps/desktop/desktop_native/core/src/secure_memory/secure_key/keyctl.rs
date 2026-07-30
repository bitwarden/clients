use crate::secure_memory::secure_key::crypto::MemoryEncryptionKey;

use super::crypto::KEY_SIZE;
use super::SecureKeyContainer;
use linux_keyutils::{KeyRing, KeyRingIdentifier};

/// The keys are bound to the process keyring.
const KEY_RING_IDENTIFIER: KeyRingIdentifier = KeyRingIdentifier::Process;
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
/// `https://man7.org/linux/man-pages/man1/keyctl.1.html`. The kernel enforces only
/// the correct process can read them, and they do not live in process memory space
/// and cannot be dumped.
pub(super) struct KeyctlSecureKeyContainer {
    /// The kernel has an identifier for the key. This is randomly generated on construction.
    id: String,
}

// SAFETY: The key id is fully owned by this struct and not exposed or cloned, and cleaned up on drop.
// Further, since we use `KeyRingIdentifier::Process` and not `KeyRingIdentifier::Thread`, the key
// is accessible across threads within the same process bound.
unsafe impl Send for KeyctlSecureKeyContainer {}
// SAFETY: The container is non-mutable and thus safe to share between threads.
unsafe impl Sync for KeyctlSecureKeyContainer {}

impl SecureKeyContainer for KeyctlSecureKeyContainer {
    fn as_key(&self) -> MemoryEncryptionKey {
        let ring = KeyRing::from_special_id(KEY_RING_IDENTIFIER, false)
            .expect("should get process keyring");
        let key = ring.search(&self.id).expect("should find key");
        let mut buffer = [0u8; KEY_SIZE];
        key.read(&mut buffer).expect("should read key");
        MemoryEncryptionKey::from(&buffer)
    }

    fn from_key(data: MemoryEncryptionKey) -> Self {
        let ring = KeyRing::from_special_id(KEY_RING_IDENTIFIER, true)
            .expect("should get process keyring");
        let id = make_id();
        ring.add_key(&id, &data).expect("should add key");
        KeyctlSecureKeyContainer { id }
    }

    fn is_supported() -> bool {
        KeyRing::from_special_id(KEY_RING_IDENTIFIER, true).is_ok()
    }
}

impl Drop for KeyctlSecureKeyContainer {
    fn drop(&mut self) {
        let ring = KeyRing::from_special_id(KEY_RING_IDENTIFIER, false)
            .expect("should get process keyring");
        if let Ok(key) = ring.search(&self.id) {
            let _ = key.invalidate();
        }
    }
}

#[cfg(test)]
mod tests {
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
    fn test_is_supported() {
        assert!(KeyctlSecureKeyContainer::is_supported());
    }
}
