export default {
  "*.rs": (stagedFiles) => [
    "cargo +nightly -Z unstable-options -C ./desktop_native fmt",
    "cargo +nightly -Z unstable-options -C ./desktop_native clippy --all-features --all-targets --tests -- -D warnings",
  ],
  "*Cargo.toml": (stagedFiles) => [
    "cargo +nightly -Z unstable-options -C ./desktop_native udeps --workspace --all-features --all-targets",
    "cargo +nightly -Z unstable-options -C ./desktop_native sort --workspace --check",
  ],
};
