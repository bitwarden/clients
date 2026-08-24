// The Objective-C sources and the `cc` build-dependency are only available
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

    const SOURCES: &[&str] = &[
        "src/native/app_group.m",
        "src/native/interop.m",
        "src/native/run_command.m",
        "src/native/utils.m",
        "src/native/autofill/run_autofill_command.m",
        "src/native/autofill/commands/status.m",
        "src/native/autofill/commands/sync.m",
        "src/native/autofill/commands/user_verification.m",
        "src/native/chromium_importer/browser_access_manager.m",
        "src/native/chromium_importer/run_chromium_command.m",
        "src/native/chromium_importer/commands/check_browser_installed.m",
        "src/native/chromium_importer/commands/has_stored_access.m",
        "src/native/chromium_importer/commands/request_access.m",
        "src/native/chromium_importer/commands/start_access.m",
        "src/native/chromium_importer/commands/stop_access.m",
    ];

    // Compile Objective-C files
    let mut builder = cc::Build::new();

    for path in SOURCES {
        assert!(
            std::path::Path::new(path).is_file(),
            "Objective-C source listed in build.rs does not exist: {path}"
        );
        builder.file(path);
        println!("cargo::rerun-if-changed={path}");
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
