#[napi]
pub mod processisolations {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn disable_coredumps() -> napi::Result<()> {
        Ok(desktop_core::process_isolation::disable_coredumps()?)
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn is_core_dumping_disabled() -> napi::Result<bool> {
        Ok(desktop_core::process_isolation::is_core_dumping_disabled()?)
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn isolate_process() -> napi::Result<()> {
        Ok(desktop_core::process_isolation::isolate_process()?)
    }
}
