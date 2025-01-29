#![cfg(target_os = "windows")]
/*
    The 'pa' (plugin authenticator) module will contain the generated
    bindgen code.

    The attributes below will suppress warnings from the generated code.
*/
#![allow(dead_code)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(non_upper_case_globals)]
#![allow(unused_imports)]

include!(concat!(
    env!("OUT_DIR"),
    "/windows_pluginauthenticator_bindings.rs"
));
