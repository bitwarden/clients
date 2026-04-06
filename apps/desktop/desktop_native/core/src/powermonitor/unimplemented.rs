#[allow(missing_docs, clippy::unused_async)]
pub async fn on_lock(_: tokio::sync::mpsc::Sender<()>) -> Result<(), Box<dyn std::error::Error>> {
    unimplemented!();
}

#[allow(missing_docs, clippy::unused_async)]
pub async fn is_lock_monitor_available() -> bool {
    false
}
