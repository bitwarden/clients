#[napi]
pub mod processisolations {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn disable_coredumps() -> napi::Result<()> {
        desktop_core::process_isolation::disable_coredumps()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn is_core_dumping_disabled() -> napi::Result<bool> {
        desktop_core::process_isolation::is_core_dumping_disabled()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn isolate_process() -> napi::Result<()> {
        desktop_core::process_isolation::isolate_process()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
