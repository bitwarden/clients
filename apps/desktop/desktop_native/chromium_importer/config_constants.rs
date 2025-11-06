// Enable this to log to a file. The way this executable is used, it's not easy to debug and the stdout gets lost.
// This is intended for development time only.
pub const ENABLE_DEVELOPER_LOGGING: bool = false;

// The absolute path to log file when developer logging is enabled
pub const LOG_FILENAME: &str = "c:\\path\\to\\log.txt";

/// Ensure the signature of the helper and main binary is validated in production builds
///
/// This must be true in release builds but may be disabled in debug builds for testing.
pub const ENABLE_SIGNATURE_VALIDATION: bool = true;
