#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

// New modular structure
mod assert;
mod com_buffer;
mod com_provider;
mod com_registration;
mod ipc;
mod ipc2;
mod make_credential;
mod sync;
mod types;
mod util;
mod webauthn;

// Re-export main functionality
pub use assert::WindowsAssertionRequest;
pub use com_registration::{add_authenticator, initialize_com_library, register_com_library};
pub use ipc::{send_passkey_request, set_request_sender};
pub use make_credential::WindowsRegistrationRequest;
pub use sync::{get_credentials_from_windows, send_sync_request, sync_credentials_to_windows};
pub use types::{
    PasskeyRequest, PasskeyResponse, RequestEvent, RequestType, SyncedCredential,
    UserVerificationRequirement,
};

use crate::util::debug_log;

/// Handles initialization and registration for the Bitwarden desktop app as a
/// For now, also adds the authenticator
pub fn register() -> std::result::Result<(), String> {
    // TODO: Can we spawn a new named thread for debugging?
    debug_log("register() called...");

    let r = com_registration::initialize_com_library();
    debug_log(&format!("Initialized the com library: {:?}", r));

    let r = com_registration::register_com_library();
    debug_log(&format!("Registered the com library: {:?}", r));

    let r = com_registration::add_authenticator();
    debug_log(&format!("Added the authenticator: {:?}", r));

    Ok(())
}

/// This sets up IPC so the plugin can request credentials from Electron.
fn setup_ipc() {}
