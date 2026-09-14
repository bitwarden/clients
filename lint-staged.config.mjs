export default {
  "*": "prettier --cache --ignore-unknown --write",
  "*.ts": "eslint --cache --cache-strategy content --fix",
  "apps/desktop/desktop_native/**/*.rs": (stagedFiles) => {
    const relativeFiles = stagedFiles.map((f) =>
      f.replace(/^.*apps\/desktop\/desktop_native\//, ""),
    );
    return [
      `node scripts/run-cargo-tool.mjs +nightly fmt -- ${relativeFiles.join(" ")}`,
      "node scripts/run-cargo-tool.mjs clippy --all-features --all-targets --tests -- -D warnings",
    ];
  },
  "apps/desktop/desktop_native/**/Cargo.toml": () => [
    // cargo-sort and cargo-udeps are pinned in [workspace.metadata.bin] and run
    // via cargo-run-bin (`cargo bin <tool>`); see scripts/lint-rust.mjs.
    "node scripts/run-cargo-tool.mjs bin cargo-sort --workspace --check",
    "node scripts/run-cargo-tool.mjs +nightly bin cargo-udeps --workspace --all-features --all-targets",
  ],
};
