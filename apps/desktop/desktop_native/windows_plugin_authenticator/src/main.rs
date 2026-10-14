#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
#![windows_subsystem = "windows"]

#[cfg(target_os = "windows")]
mod assert;
#[cfg(target_os = "windows")]
mod authenticator;
#[cfg(target_os = "windows")]
mod ipc;
#[cfg(target_os = "windows")]
mod make_credential;
#[cfg(target_os = "windows")]
mod util;

#[cfg(target_os = "windows")]
use std::{mem::MaybeUninit, path::PathBuf};

#[cfg(target_os = "windows")]
use desktop_core::autofill::read_plugin_config_file;
#[cfg(target_os = "windows")]
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
// Re-export main functionality
#[cfg(target_os = "windows")]
use win_webauthn::plugin::Clsid;
#[cfg(target_os = "windows")]
use windows::{
    Storage::ApplicationData,
    Win32::{
        System::Threading::GetCurrentThreadId,
        UI::WindowsAndMessaging::{DispatchMessageA, GetMessageA},
    },
};

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
    #[allow(clippy::print_stdout)]
    std::panic::set_hook(Box::new(move |panic_info| {
        default_hook(panic_info); // Call the default hook to print the panic message

        // try to print to file too
        let msg = panic_info.payload_as_str().unwrap_or("<unknown>");
        let location = panic_info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());
        tracing::error!(%msg, %location, "Program panicked.");
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

    let log_file = open_log_file()?;

    // With the `tracing-log` feature enabled for the `tracing_subscriber`,
    // the registry below will initialize a log compatibility layer, which allows
    // the subscriber to consume log::Records as though they were tracing Events.
    // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/util/trait.SubscriberInitExt.html#method.init
    let log_file_layer = tracing_subscriber::fmt::layer()
        .with_writer(log_file)
        .with_ansi(false);
    tracing_subscriber::registry()
        .with(filter)
        .with(log_file_layer)
        .try_init()?;
    let args: Vec<String> = std::env::args().collect();
    tracing::debug!("Launched with arguments: {args:?}");
    let command = args.get(1).map(|s| s.as_str());
    match command {
        Some("serve") => {
            let thread_id = unsafe { GetCurrentThreadId() };
            tracing::info!(%thread_id, "Starting plugin authenticator...");
            let clsid = {
                let com_id = read_plugin_config_file()?
                    .ok_or("Plugin authenticator is not running from an Appx package")?
                    .clsid;
                Clsid::try_from(format!("{{{}}}", com_id).as_str()).map_err(|err| {
                    format!("Could not read plugin authenticator CLSID from config file: {err}")
                })?
            };
            let mut plugin = authenticator::run_server(clsid)?;
            tracing::info!(%thread_id, "Listening for passkey requests...");
            loop {
                let mut msg = MaybeUninit::uninit();
                match unsafe { GetMessageA(msg.as_mut_ptr(), None, 0, 0).0 } {
                    // WM_QUIT was sent, exit the loop
                    0 => break,
                    -1 => {
                        let err = windows::core::Error::from_thread();
                        tracing::error!(%err, "Failed to read message from message loop, stopping server.");
                        Err(err)?;
                    }
                    _ => unsafe {
                        let msg = msg.assume_init_ref();
                        DispatchMessageA(msg);
                    },
                }
            }
            tracing::info!("Stopping server");
            plugin.shutdown_server()?;
        }
        Some(invalid) => {
            tracing::error!("Invalid command argument passed: {invalid}. Specify one of [serve]");
            Err(format!(
                "Invalid command argument passed: {invalid}. Specify one of [serve]"
            ))?;
        }
        None => {
            tracing::error!("No command argument passed. Specify one of [serve]");
            Err("No command argument passed. Specify one of [serve]")?;
        }
    };

    Ok(())
}

/// Opens the log file next to the desktop app's `app.log`, which Electron
/// writes to the root of its `userData` directory.
///
/// When running from an Appx package, the desktop app uses the unsandboxed
/// `%APPDATA%\<product name>` if it already exists (e.g. from a previous
/// non-Appx install). Otherwise, Appx redirects its writes to the package's
/// `LocalCache\Roaming\<product name>` folder, so we fall back to that.
#[cfg(target_os = "windows")]
fn open_log_file() -> Result<std::fs::File, Box<dyn std::error::Error>> {
    let open = |user_data_path: PathBuf| {
        std::fs::File::options()
            .append(true)
            .create(true)
            .open(user_data_path.join("passkey_plugin.log"))
    };

    // These match the `userData` overrides in apps/desktop/src/main.ts.
    if let Ok(app_data_path) = std::env::var("BITWARDEN_APPDATA_DIR") {
        return Ok(open(PathBuf::from(app_data_path))?);
    }
    if let Ok(portable_path) = std::env::var("PORTABLE_EXECUTABLE_DIR") {
        return Ok(open(
            PathBuf::from(portable_path).join("bitwarden-appdata"),
        )?);
    }

    // The plugin name matches the Electron `productName` that names the `userData` folder.
    let product_name =
        read_plugin_config_file()?.map_or_else(|| "Bitwarden".to_string(), |config| config.name);

    let unsandboxed_path =
        PathBuf::from(std::env::var("APPDATA").expect("%APPDATA% to be defined"))
            .join(&product_name);
    let unsandboxed_err = match open(unsandboxed_path) {
        Ok(log_file) => return Ok(log_file),
        Err(err) => err,
    };

    let sandboxed_path = ApplicationData::Current()
        .and_then(|app_data| app_data.LocalCacheFolder())
        .and_then(|folder| folder.Path())
        .map(|path| PathBuf::from(path.to_os_string()).join("Roaming").join(&product_name))
        .map_err(|err| {
            format!("Could not open log file in %APPDATA% ({unsandboxed_err}) and could not read Appx package data folder: {err}")
        })?;
    Ok(open(sandboxed_path)?)
}
