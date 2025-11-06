include!("config_constants.rs");

fn main() {
    if cfg!(not(debug_assertions)) {
        if ENABLE_DEVELOPER_LOGGING {
            compile_error!("ENABLE_DEVELOPER_LOGGING must be false in release builds");
        }

        if !ENABLE_SERVER_SIGNATURE_VALIDATION {
            compile_error!("ENABLE_SERVER_SIGNATURE_VALIDATION must be true in release builds");
        }
    }

    if std::env::var("CARGO_CFG_TARGET_OS").expect("to be set by cargo") == "windows" {
        println!("cargo:rerun-if-changed=resources.rc");

        embed_resource::compile("resources.rc", embed_resource::NONE)
            .manifest_optional()
            .expect("to compile resources");
    }
}
