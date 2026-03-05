fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").expect("to be set by cargo") == "windows" {
        println!("cargo:rerun-if-changed=resources.rc");

        embed_resource::compile("resources.rc", embed_resource::NONE)
            .manifest_optional()
            .expect("to compile resources");
    }
}
