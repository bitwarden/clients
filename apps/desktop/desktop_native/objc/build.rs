#[cfg(target_os = "macos")]
fn main() {
    use std::process::Command;

    use glob::glob;

    let out_dir = std::env::var("OUT_DIR").unwrap();

    // Compile Swift files FIRST (generates Bitwarden-Swift.h for browser_access.m)
    let swift_files: Vec<String> = glob("src/native/**/*.swift")
        .expect("Failed to read Swift glob pattern")
        .filter_map(Result::ok)
        .map(|p| {
            println!("cargo::rerun-if-changed={}", p.display());
            p.to_str().unwrap().to_string()
        })
        .collect();

    if !swift_files.is_empty() {
        // Compile Swift into a static library
        let status = Command::new("swiftc")
            .args(&[
                "-emit-library",
                "-static",
                "-module-name",
                "Bitwarden",
                "-import-objc-header",
                "src/native/bridging-header.h",
                "-emit-objc-header-path",
                &format!("{}/Bitwarden-Swift.h", out_dir),
                "-o",
                &format!("{}/libbitwarden_swift.a", out_dir),
            ])
            .args(&swift_files)
            .status()
            .expect("Failed to compile Swift code");

        if !status.success() {
            panic!("Swift compilation failed");
        }

        // Tell cargo to link the Swift library
        println!("cargo:rustc-link-search=native={}", out_dir);
        println!("cargo:rustc-link-lib=static=bitwarden_swift");

        // Link required Swift/Foundation frameworks
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }

    // Compile Objective-C files (Bitwarden-Swift.h exists now)
    let mut builder = cc::Build::new();

    // Compile all .m files in the src/native directory
    for entry in glob("src/native/**/*.m").expect("Failed to read glob pattern") {
        let path = entry.expect("Failed to read glob entry");
        builder.file(path.clone());
        println!("cargo::rerun-if-changed={}", path.display());
    }

    builder
        .include(&out_dir) // Add OUT_DIR to include path so Bitwarden-Swift.h can be found
        .flag("-fobjc-arc") // Enable Auto Reference Counting (ARC)
        .compile("objc_code");
}

#[cfg(not(target_os = "macos"))]
fn main() {
    // Crate is only supported on macOS
}
