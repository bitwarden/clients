//! Store a secret in the encrypted in-memory store and read it back.
//!
//! The value is encrypted at rest in process memory (AES-256-GCM under a platform-protected key),
//! so it stays out of memory dumps and swap until it is read back.
//!
//! Run with: `cargo run --example store_and_retrieve -p secure_memory`

// This example demonstrates the store by printing its results to stdout.
#![allow(clippy::print_stdout)]

use secure_memory::{EncryptedMemoryStore, SecureMemoryStore};

fn main() {
    // Keys can be any `Ord + Display + Clone` type; here we key by user id.
    let mut store: EncryptedMemoryStore<String> = EncryptedMemoryStore::new();

    let user_id = "user-123".to_string();
    let secret = b"super secret vault key";

    // Store the secret. It is encrypted immediately and only decrypted on `get`.
    store.put(user_id.clone(), secret);
    assert!(store.has(&user_id));

    // Retrieve and decrypt it. `get` returns `Ok(None)` for a missing key and `Err` only if the
    // ciphertext could not be decrypted (e.g. tampering).
    let retrieved = store
        .get(&user_id)
        .expect("decryption should succeed")
        .expect("a value was stored for this key");
    assert_eq!(retrieved, secret);
    println!("retrieved {} bytes for {user_id}", retrieved.len());

    // Remove it; subsequent reads return `None`.
    store.remove(&user_id);
    assert!(!store.has(&user_id));
    assert!(store
        .get(&user_id)
        .expect("decryption should succeed")
        .is_none());

    println!("secure_memory example OK");
}
