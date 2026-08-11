#[napi]
pub mod managed_settings {
    use napi::{
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
        tokio,
    };

    /// The host's managed-settings container value, or `None` when the host declares none.
    #[allow(clippy::unused_async)]
    #[napi]
    pub async fn read() -> napi::Result<Option<String>> {
        desktop_core::managed_settings::read().map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Invokes `callback` whenever the host's managed configuration changes.
    #[allow(clippy::unused_async)]
    #[napi]
    pub async fn watch(callback: ThreadsafeFunction<()>) -> napi::Result<()> {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(8);
        desktop_core::managed_settings::watch(tx)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        tokio::spawn(async move {
            while let Some(()) = rx.recv().await {
                callback.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
            }
        });
        Ok(())
    }
}
