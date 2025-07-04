use anyhow::{bail, Result};
use napi::threadsafe_function::{
    ErrorStrategy::CalleeHandled, ThreadsafeFunction,
};

#[napi(object)]
#[derive(Debug)]
pub struct PasskeyRequestEvent {
    pub operation: String,
    pub rpid: String,
    pub transaction_id: String,
}

pub fn register() -> Result<()> {
    bail!("Not implemented")
}

pub async fn on_request(
    _callback: ThreadsafeFunction<PasskeyRequestEvent, CalleeHandled>,
) -> napi::Result<String> {
    Err(napi::Error::from_reason("Passkey authenticator is not supported on this platform".to_string()))
}
