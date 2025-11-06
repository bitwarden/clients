// Include shared configuration constants (also used in build.rs for compile-time validation)
include!("../../config_constants.rs");

// List of SYSTEM process names to try to impersonate
pub(crate) const SYSTEM_PROCESS_NAMES: [&str; 2] = ["services.exe", "winlogon.exe"];
