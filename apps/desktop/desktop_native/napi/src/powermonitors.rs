#[napi]
pub mod powermonitors {
    use napi::{
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
        tokio,
    };

    #[napi]
    pub async fn on_lock(callback: ThreadsafeFunction<()>) -> napi::Result<()> {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(32);
        desktop_core::powermonitor::on_lock(tx)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        tokio::spawn(async move {
            while let Some(()) = rx.recv().await {
                callback.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
            }
        });
        Ok(())
    }

    #[napi]
    pub async fn is_lock_monitor_available() -> napi::Result<bool> {
        Ok(desktop_core::powermonitor::is_lock_monitor_available().await)
    }
}
