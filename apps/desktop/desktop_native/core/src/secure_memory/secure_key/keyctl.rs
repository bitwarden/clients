use crate::secure_memory::secure_key::crypto::MemoryEncryptionKey;

use super::crypto::KEY_SIZE;
use super::SecureKeyContainer;
use linux_keyutils::{KeyRing, KeyRingIdentifier};

/// The keys are bound to the process keyring. The kernel enforces only the correct process can read them, and they
/// do not live in process memory space and cannot be dumped. `https://man7.org/linux/man-pages/man1/keyctl.1.html`
const KEY_RING_IDENTIFIER: KeyRingIdentifier = KeyRingIdentifier::Process;

/// This is a global static ID counter. Each new key gets a new ID.
static COUNTER: std::sync::Mutex<u64> = std::sync::Mutex::new(0);
fn generate_id() -> String {
    let mut counter = COUNTER.lock().expect("should lock counter");
    *counter += 1;
    format!("bitwarden_desktop_{}_{}", rand::random::<i64>(), *counter)
}

/// A secure key container that uses the Linux kernel keyctl API to store the key.
/// `https://man7.org/linux/man-pages/man1/keyctl.1.html`
pub(super) struct KeyctlSecureKeyContainer {
    /// The kernel has a string identifier for the key. This is randomly generated on construction.
    id: String,
}

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
        let id = generate_id();
        let ring = KeyRing::from_special_id(KEY_RING_IDENTIFIER, true)
            .expect("should get process keyring");
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
