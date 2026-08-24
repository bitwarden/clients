// The Objective-C sources and the `cc`/`glob` build-dependencies are only available
// on a macOS host (see the target-gated `build-dependencies` in Cargo.toml, which are
// resolved against the host). Guard the compiling `main` with a host `cfg` so this
// build script still compiles when building natively on other platforms.
#[cfg(target_os = "macos")]
fn main() {
    // Build scripts run on the host, so the `#[cfg(target_os = "macos")]` above reflects
    // the host, not the build target. When cross-compiling from macOS to another OS
    // (e.g. Windows via `cargo xwin`) this `main` still runs, so check the target OS
    // Cargo exposes and skip the Objective-C compilation for non-macOS targets.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
        return;
    }

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
