use tracing::{error, level_filters::LevelFilter};
use tracing_subscriber::{
    fmt, layer::SubscriberExt as _, util::SubscriberInitExt as _, EnvFilter, Layer as _,
};

use super::config::{ENABLE_DEVELOPER_LOGGING, LOG_FILENAME};

pub(crate) fn init_logging() {
    if ENABLE_DEVELOPER_LOGGING {
        // We only log to a file. It's impossible to see stdout/stderr when this exe is launched
        // from ShellExecuteW.
        match std::fs::File::create(LOG_FILENAME) {
            Ok(file) => {
                let file_filter = EnvFilter::builder()
                    .with_default_directive(LevelFilter::DEBUG.into())
                    .from_env_lossy();

                let file_layer = fmt::layer()
                    .with_writer(file)
                    .with_ansi(false)
                    .with_filter(file_filter);

                tracing_subscriber::registry().with(file_layer).init();
            }
            Err(error) => {
                error!(%error, ?LOG_FILENAME, "Could not create log file.");
            }
        }
    }
}
