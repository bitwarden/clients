// This module deliberately prints to the elevated console when developer logging is enabled
// and the tracing subscriber cannot be installed yet (or its log file cannot be created).
// `eprintln!` is the only observable channel at that point, so the workspace `print_stderr`
// deny is allowed here for that narrow, developer-only diagnostic path.
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

    // When developer logging is enabled this exe is launched with a visible console window
    // (see `decrypt_with_admin_exe_internal`), so stdout/stderr are observable. Until the
    // tracing subscriber below is installed, an `error!` would be dropped, so any setup
    // failure is reported directly via `eprintln!`.
    let log_file = match create_log_file() {
        Ok(file) => file,
        Err(error) => {
            eprintln!("Could not create a developer log file anywhere: {error}");
            // Hold the elevated console window open so the failure can actually be read
            // before the process exits and the window disappears.
            wait_for_keypress();
            return;
        }
    };

    let file_filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::DEBUG.into())
        .from_env_lossy();

    let file_layer = fmt::layer()
        .with_writer(log_file)
        .with_ansi(false)
        .with_filter(file_filter);

    tracing_subscriber::registry().with(file_layer).init();
}

/// Create the developer log file, creating any missing parent directories first.
///
/// `File::create` does not create missing parent directories, so the configured
/// [`LOG_FILENAME`] directory is created up front. If the configured path still cannot be
/// created (e.g. it points at a directory that isn't writable in this elevated context),
/// fall back to a path that is reliably writable by the elevated helper process.
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

fn wait_for_keypress() {
    eprintln!("Press Enter to continue...");
    let mut buffer = String::new();
    let _ = std::io::stdin().read_line(&mut buffer);
}
