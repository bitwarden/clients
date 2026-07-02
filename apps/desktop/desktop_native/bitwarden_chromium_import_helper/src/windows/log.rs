// When developer logging is enabled the helper runs in a visible elevated console (see
// `decrypt_with_admin_exe_internal`) that is held open at exit (see `main`). `eprintln!` is the
// only channel available before the tracing subscriber is installed, so the workspace
// `print_stderr` deny is allowed here for that narrow, developer-only diagnostic path.
#![allow(clippy::print_stderr)]

use std::{fs::File, path::Path};

use chromium_importer::config::{ENABLE_DEVELOPER_LOGGING, LOG_FILENAME};
use tracing::level_filters::LevelFilter;
use tracing_subscriber::{
    fmt, layer::SubscriberExt as _, util::SubscriberInitExt as _, EnvFilter, Layer as _,
};

pub(crate) fn init_logging() {
    if !ENABLE_DEVELOPER_LOGGING {
        return;
    }

    // Always log to the (visible, held-open) console so output is observable live even if the
    // log file cannot be created. Add a file layer on top when the file can be opened.
    let stdout_layer = fmt::layer()
        .with_writer(std::io::stdout)
        .with_ansi(false)
        .with_filter(debug_filter());

    let file_layer = match create_log_file() {
        Ok(file) => Some(
            fmt::layer()
                .with_writer(file)
                .with_ansi(false)
                .with_filter(debug_filter()),
        ),
        Err(error) => {
            // No subscriber is installed yet, so print directly to the console.
            eprintln!("Could not create a developer log file: {error}. Logging to console only.");
            None
        }
    };

    // `Option<Layer>` is a no-op layer when `None`, so this works whether or not the file opened.
    tracing_subscriber::registry()
        .with(stdout_layer)
        .with(file_layer)
        .init();
}

fn debug_filter() -> EnvFilter {
    EnvFilter::builder()
        .with_default_directive(LevelFilter::DEBUG.into())
        .from_env_lossy()
}

/// Open the developer log file for writing.
///
/// `File::create` won't create missing parent directories, so this first attempts
/// `create_dir_all` on [`LOG_FILENAME`]'s parent. That recursively creates *every* missing
/// directory in the path (note: a hardcoded path like `…\john\logging` is fabricated in full
/// even on a machine with no such user), and it is best-effort — if it or the subsequent
/// `File::create` fails, fall back to a file in [`std::env::temp_dir`].
fn create_log_file() -> std::io::Result<File> {
    let primary = Path::new(LOG_FILENAME);
    match create_at(primary) {
        Ok(file) => Ok(file),
        Err(primary_error) => {
            let fallback = std::env::temp_dir().join("bitwarden_chromium_import_helper.log");
            eprintln!(
                "Could not create log file at {}: {primary_error}. Falling back to {}.",
                primary.display(),
                fallback.display(),
            );
            create_at(&fallback)
        }
    }
}

fn create_at(path: &Path) -> std::io::Result<File> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    File::create(path)
}

/// Block until the user presses Enter. Called on every exit path of the helper (when developer
/// logging is enabled) to hold the elevated console window open so its output can actually be
/// read before the short-lived process terminates.
pub(crate) fn wait_for_keypress() {
    eprintln!("\n[bitwarden_chromium_import_helper] Press Enter to close this window...");
    let mut buffer = String::new();
    let _ = std::io::stdin().read_line(&mut buffer);
}
