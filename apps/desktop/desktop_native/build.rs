extern crate napi_build;
use swift_rs::SwiftLinker;

fn main() {
    napi_build::setup();
    SwiftLinker::new("10.13")
        .with_package("macos-swift", "./src/biometric/macos-swift")
        .link();
}
