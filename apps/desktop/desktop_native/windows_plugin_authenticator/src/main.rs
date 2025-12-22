#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
#![windows_subsystem = "windows"]

#[cfg(target_os = "windows")]
mod assert;
#[cfg(target_os = "windows")]
mod ipc2;
#[cfg(target_os = "windows")]
mod make_credential;
#[cfg(target_os = "windows")]
mod process;
#[cfg(target_os = "windows")]
mod types;
#[cfg(target_os = "windows")]
mod util;

#[cfg(target_os = "windows")]
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use tracing_appender::rolling::{RollingFileAppender, Rotation};
#[cfg(target_os = "windows")]
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{DispatchMessageA, GetMessageA, TranslateMessage};

// Re-export main functionality
#[cfg(target_os = "windows")]
pub use types::UserVerificationRequirement;

#[cfg(not(target_os = "windows"))]
fn main() {
    unimplemented!("Not implemented on non-Windows platforms.");
}

/// Handles initialization and registration for the Bitwarden desktop app as a
/// For now, also adds the authenticator
#[cfg(target_os = "windows")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Set the custom panic hook
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        default_hook(panic_info); // Call the default hook to print the panic message

        // Only pause if not running in a debugger, etc.
        // On Windows, if the process is a console app, stdin/stdout might work differently
        // when launched from Explorer vs a terminal.

        println!("\nProgram panicked! Press Enter to exit...");
        std::io::stdin()
            .read_line(&mut String::new())
            .expect("Failed to read line");
    }));

    // the log level hierarchy is determined by:
    //    - if RUST_LOG is detected at runtime
    //    - if RUST_LOG is provided at compile time
    //    - default to INFO
    let filter = EnvFilter::builder()
        .with_default_directive(
            option_env!("RUST_LOG")
                .unwrap_or("info")
                .parse()
                .expect("should provide valid log level at compile time."),
        )
        // parse directives from the RUST_LOG environment variable,
        // overriding the default directive for matching targets.
        .from_env_lossy();

    let app_data_path = std::env::var("BITWARDEN_APPDATA_DIR")
        .or_else(|_| std::env::var("PORTABLE_EXECUTABLE_DIR"))
        .map_or_else(
            |_| {
                [
                    &std::env::var("APPDATA").expect("%APPDATA% to be defined"),
                    "Bitwarden",
                ]
                .iter()
                .collect()
            },
            PathBuf::from,
        );

    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::NEVER)
        .filename_prefix("passkey_plugin")
        .filename_suffix("log")
        .build(app_data_path)?; // TODO: should we allow continuing if we can't log?
    let (writer, _guard) = tracing_appender::non_blocking(file_appender);

    // With the `tracing-log` feature enabled for the `tracing_subscriber`,
    // the registry below will initialize a log compatibility layer, which allows
    // the subscriber to consume log::Records as though they were tracing Events.
    // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/util/trait.SubscriberInitExt.html#method.init
    let log_file_layer = tracing_subscriber::fmt::layer()
        .with_writer(writer)
        .with_ansi(false);
    tracing_subscriber::registry()
        .with(filter)
        .with(log_file_layer)
        .try_init()?;
    let args: Vec<String> = std::env::args().collect();
    tracing::debug!("Launched with arguments: {args:?}");
    let command = args.get(1).map(|s| s.as_str());
    match command {
        Some("add") => process::add_authenticator()?,
        Some("serve") => process::run_server()?,
        Some(invalid) => {
            tracing::error!(
                "Invalid command argument passed: {invalid}. Specify one of [add, serve]"
            );
            return Err(format!(
                "No command argument passed: {invalid}. Specify one of [add, serve]"
            ))?;
        }
        None => {
            tracing::error!("No command argument passed. Specify one of [add, serve]");
            return Err("No command argument passed. Specify one of [add, serve]")?;
        }
    };
    tracing::debug!("Starting loop");

    loop {
        let mut msg_ptr = std::mem::MaybeUninit::uninit();
        unsafe {
            GetMessageA(msg_ptr.as_mut_ptr(), None, 0, 0)
                .ok()
                .inspect_err(|err| {
                    tracing::error!("Received error while waiting for message: {err}")
                })?;
            tracing::debug!("Received message, dispatching");
            let msg = msg_ptr.assume_init_ref();
            let result = TranslateMessage(msg);
            tracing::debug!("Message translated? {result:?}");
            let result = DispatchMessageA(msg);
            tracing::debug!("Received result from message handler: {result:?}");
        }
    }
}
