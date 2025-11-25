#[cfg(target_os = "macos")]
fn main() {
    use glob::glob;

    // Compile Objective-C files
    let mut builder = cc::Build::new();

    // Compile all .m files in the src/native directory
    for entry in glob("src/native/**/*.m").expect("Failed to read glob pattern") {
        let path = entry.expect("Failed to read glob entry");
        builder.file(path.clone());
        println!("cargo::rerun-if-changed={}", path.display());
    }

    builder
        .flag("-fobjc-arc") // Enable Auto Reference Counting (ARC)
        .compile("objc_code");

    // Link required frameworks
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=AppKit");
}

#[cfg(not(target_os = "macos"))]
fn main() {
    // Crate is only supported on macOS
}
