use anyhow::{bail, Result};
use napi::threadsafe_function::{ErrorStrategy::CalleeHandled, ThreadsafeFunction};

// Use the PasskeyRequestEvent from the parent module
pub use crate::passkey_authenticator::{PasskeyRequestEvent, SyncedCredential};

pub fn register() -> Result<()> {
    bail!("Not implemented")
}

pub async fn on_request(
    _callback: ThreadsafeFunction<PasskeyRequestEvent, CalleeHandled>,
) -> napi::Result<String> {
    Err(napi::Error::from_reason(
        "Passkey authenticator is not supported on this platform",
    ))
}

pub fn sync_credentials_to_windows(_credentials: Vec<SyncedCredential>) -> napi::Result<()> {
    Err(napi::Error::from_reason(
        "Windows credential sync not supported on this platform",
    ))
}

pub fn get_credentials_from_windows() -> napi::Result<Vec<SyncedCredential>> {
    Err(napi::Error::from_reason(
        "Windows credential retrieval not supported on this platform",
    ))
}
