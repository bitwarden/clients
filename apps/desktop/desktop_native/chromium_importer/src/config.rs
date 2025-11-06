// Enable this to log to a file. The way this executable is used, it's not easy to debug and the stdout gets lost.
// This is intended for development time only. All the logging is wrapped in `dbg_log!` macro that compiles to
// no-op when logging is disabled. This is needed to avoid any sensitive data being logged in production.
pub const ENABLE_DEVELOPER_LOGGING: bool = false;

// The absolute path to log file when developer logging is enabled
pub const LOG_FILENAME: &str = "c:\\path\\to\\log.txt";

// This should be enabled for production
pub const ENABLE_SIGNATURE_VALIDATION: bool = true;
