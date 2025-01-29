fn main() {
    #[cfg(target_os = "windows")]
    windows();
}

#[allow(dead_code)]
fn windows() {
    // TODO: Use .allowlist_x() to specify needed items
    let bindings = bindgen::Builder::default()
        .header("pluginauthenticator.hpp")
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .generate()
        .expect("Unable to generate bindings.");

    bindings
        .write_to_file("windows_pluginauthenticator_bindings.rs")
        .expect("Couldn't write bindings.");
}
