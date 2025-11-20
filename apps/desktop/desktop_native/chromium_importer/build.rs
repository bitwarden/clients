include!("config_constants.rs");

fn main() {
    println!("cargo:rerun-if-changed=config_constants.rs");

    if cfg!(not(debug_assertions)) {
        if ENABLE_DEVELOPER_LOGGING {
            panic!("ENABLE_DEVELOPER_LOGGING must be false in release builds");
        }

        if !ENABLE_SIGNATURE_VALIDATION {
            panic!("ENABLE_SIGNATURE_VALIDATION must be true in release builds");
        }
    }
}
