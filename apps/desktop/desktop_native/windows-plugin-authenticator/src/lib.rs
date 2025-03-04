#![cfg(target_os = "windows")]

mod pa;

pub fn get_version_number() -> u64 {
    unsafe { pa::WebAuthNGetApiVersionNumber() }.into()
}

pub fn add_authenticator() {
    unimplemented!();
}
