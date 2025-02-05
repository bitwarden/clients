fn main() {
    #[cfg(target_os = "windows")]
    windows();
}

#[cfg(target_os = "windows")]
fn windows() {
    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");

    let bindings = bindgen::Builder::default()
        .header("pluginauthenticator.hpp")
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .generate()
        .expect("Unable to generate bindings.");

    bindings
        .write_to_file(format!(
            "{}\\windows_pluginauthenticator_bindings.rs",
            out_dir
        ))
        .expect("Couldn't write bindings.");
}
