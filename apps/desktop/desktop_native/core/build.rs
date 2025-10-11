use swift_rs::SwiftLinker;

const PACKAGE_NAME: &str = "MacTest";
const PACKAGE_PATH: &str = "./src/MacTest";

fn build() {
    SwiftLinker::new("10.13")
        .with_package(PACKAGE_NAME, PACKAGE_PATH)
        .link();
}

fn main() {
    build();
}
