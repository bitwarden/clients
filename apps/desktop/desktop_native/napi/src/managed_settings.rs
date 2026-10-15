#[napi]
pub mod managed_settings {
    use napi::{
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
        tokio,
    };

    /// The host's managed-settings container value, or `null` when the host declares none.
    /// Rejects when the host state cannot be determined, for example because the policy key
    /// exists but cannot be opened.
    // Async so that the blocking host read runs on the napi runtime, not on the JavaScript thread.
    #[allow(clippy::unused_async)]
    #[napi]
    pub async fn read() -> napi::Result<Option<String>> {
        desktop_core::managed_settings::read()
            .map_err(|e| napi::Error::from_reason(format!("{e:#}")))
    }

    /// Invokes `callback` whenever the host's managed configuration changes. Does nothing on
    /// platforms whose main process watches through other means.
    // Async so that `tokio::spawn` runs inside the napi runtime.
    #[allow(clippy::unused_async)]
    #[napi]
    pub async fn watch(callback: ThreadsafeFunction<()>) -> napi::Result<()> {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(8);
        desktop_core::managed_settings::watch(tx)
            .map_err(|e| napi::Error::from_reason(format!("{e:#}")))?;
        tokio::spawn(async move {
            while let Some(()) = rx.recv().await {
                callback.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
            }
        });
        Ok(())
    }
}
