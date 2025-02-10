/*
    The 'pa' (plugin authenticator) module will contain the generated
    bindgen code.

    The attributes below will suppress warnings from the generated code.
*/

#![cfg(target_os = "windows")]
#![allow(clippy::all)]
#![allow(warnings)]

include!(concat!(
    env!("OUT_DIR"),
    "/windows_pluginauthenticator_bindings.rs"
));
