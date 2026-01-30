#[cfg(target_os = "macos")]
fn main() {
    uniffi::uniffi_bindgen_main()
}

#[cfg(not(target_os = "macos"))]
fn main() {
    unimplemented!("uniffi-bindgen is not enabled on this target.");
}
