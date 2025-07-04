#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::ffi::{c_uchar, c_ulong, OsString};
use std::os::windows::ffi::OsStrExt;
use std::{thread, time::Duration};
use windows_core::*;

// New modular structure
mod assert;
mod make_credential;
mod sync;
mod ipc;
mod com_registration;
pub mod utils;
mod types;
mod webauthn;
mod com_provider;
mod com_buffer;


// Re-export main functionality
pub use sync::{send_sync_request, sync_credentials_to_windows, get_credentials_from_windows};
pub use ipc::{set_request_sender, send_passkey_request};
pub use types::{PasskeyRequest, PasskeyResponse, SyncedCredential, RequestEvent, RequestType};
pub use com_registration::{initialize_com_library, register_com_library, add_authenticator};

// Re-export utilities
pub use utils as util;

const AUTHENTICATOR_NAME: &str = "Bitwarden Desktop Authenticator";
//const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";
const RPID: &str = "bitwarden.com";

/// Handles initialization and registration for the Bitwarden desktop app as a
/// plugin authenticator with Windows.
/// For now, also adds the authenticator
pub fn register() -> std::result::Result<(), String> {
    util::message("register() called");

    util::message("About to call initialize_com_library()");
    let r = com_registration::initialize_com_library();
    util::message(&format!("initialized the com library: {:?}", r));

    util::message("About to call register_com_library()");
    let r = com_registration::register_com_library();
    util::message(&format!("registered the com library: {:?}", r));

    util::message("About to call add_authenticator()");
    let r = com_registration::add_authenticator();
    //let r = add_authenticator_using_wide_encoding();
    util::message(&format!("added the authenticator: {:?}", r));

    util::message("sleeping for 5 seconds...");
    thread::sleep(Duration::from_millis(5000));
    util::message("sleeping done");

    let r = syncCredentials();
    util::message(&format!("sync credentials: {:?}", r));
    
    if let Err(e) = r {
        util::message(&format!("syncCredentials failed: {}", e));
    }

    Ok(())
}

fn syncCredentials() -> std::result::Result<(), String> {
    // Create a test credential using the new sync module with more realistic data
    let test_credential = types::SyncedCredential {
        credential_id: vec![
            0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
            0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
            0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00,
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08
        ], // 32 byte credential ID
        rp_id: "webauthn.io".to_string(),
        user_name: "testuser".to_string(),
        user_id: vec![0x75, 0x73, 0x65, 0x72, 0x31, 0x32, 0x33, 0x34], // "user1234" as bytes
    };
    
    let credentials = vec![test_credential];
    
    // Use the sync module to sync credentials
    sync_credentials_to_windows(credentials, CLSID)
}




