#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "windows")]
mod config;

#[cfg(target_os = "windows")]
mod impersonate;

#[cfg(target_os = "windows")]
mod crypto;

#[cfg(target_os = "windows")]
mod log;

#[cfg(target_os = "windows")]
#[tokio::main]
async fn main() {
    windows::main().await;
}

#[cfg(not(target_os = "windows"))]
fn main() {
    // Empty
}
