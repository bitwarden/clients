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
    "node scripts/run-cargo-tool.mjs sort --workspace --check",
    "node scripts/run-cargo-tool.mjs +nightly udeps --workspace --all-features --all-targets",
    "node scripts/run-cargo-tool.mjs deny --log-level error --all-features check all",
  ],
};
