// Enable this to log to a file. The way this executable is used, it's not easy to debug and the stdout gets lost.
// This is intended for development time only. All the logging is wrapped in `dbg_log!`` macro that compiles to
// no-op when logging is disabled. This is needed to avoid any sensitive data being logged in production.
pub(crate) const ENABLE_DEVELOPER_LOGGING: bool = false;
pub(crate) const LOG_FILENAME: &str = "c:\\path\\to\\log.txt"; // This is an example filename, replace it with you own

// This should be enabled for production
pub(crate) const ENABLE_SERVER_SIGNATURE_VALIDATION: bool = true;

// List of SYSTEM process names to try to impersonate
pub(crate) const SYSTEM_PROCESS_NAMES: [&str; 2] = ["services.exe", "winlogon.exe"];
