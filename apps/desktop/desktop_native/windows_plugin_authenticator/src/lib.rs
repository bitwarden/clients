#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

// New modular structure
mod assert;
mod com_buffer;
mod com_provider;
mod com_registration;
mod ipc2;
mod make_credential;
mod types;
mod util;
mod webauthn;

// Re-export main functionality
pub use com_registration::{add_authenticator, initialize_com_library, register_com_library};
pub use types::UserVerificationRequirement;

/// Handles initialization and registration for the Bitwarden desktop app as a
/// For now, also adds the authenticator
pub fn register() -> std::result::Result<(), String> {
    // TODO: Can we spawn a new named thread for debugging?
    tracing::debug!("register() called...");

    let r = com_registration::initialize_com_library();
    tracing::debug!("Initialized the com library: {:?}", r);

    let r = com_registration::register_com_library();
    tracing::debug!("Registered the com library: {:?}", r);

    let r = com_registration::add_authenticator();
    tracing::debug!("Added the authenticator: {:?}", r);

    Ok(())
}
