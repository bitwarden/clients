#[cfg(feature = "uniffi")]
fn main() {
    uniffi::uniffi_bindgen_main()
}

#[cfg(not(feature = "uniffi"))]
fn main() {
    unimplemented!("The uniffi feature is not enabled; uniffi-bindgen will not be built");
}
