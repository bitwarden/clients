#![cfg_attr(target_os = "windows", expect(unused))]
#[cfg(target_os = "windows")]
mod assert;
#[cfg(target_os = "windows")]
mod authenticator;
#[cfg(target_os = "windows")]
mod ipc;
#[cfg(target_os = "windows")]
mod make_credential;
#[cfg(target_os = "windows")]
mod util;

fn main() {}
