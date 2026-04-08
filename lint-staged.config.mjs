export default {
  "*": "prettier --cache --ignore-unknown --write",
  "*.ts": "eslint --cache --cache-strategy content --fix",
  "apps/desktop/desktop_native/**/*.rs": (stagedFiles) => {
    const relativeFiles = stagedFiles.map((f) =>
      f.replace(/^.*apps\/desktop\/desktop_native\//, ""),
    );
    return [
      `sh -c 'cd apps/desktop/desktop_native && cargo +nightly fmt -- ${relativeFiles.join(" ")}'`,
      `sh -c 'cd apps/desktop/desktop_native && cargo clippy --all-features --all-targets --tests -- -D warnings'`,
    ];
  },
  "apps/desktop/desktop_native/**/Cargo.toml": () => {
    const hint =
      "\nIf you are missing the required Rust tools, you can install them with scripts/prepare-env-rust.sh\n";
    return [
      `sh -c 'cd apps/desktop/desktop_native && cargo sort --workspace --check || (echo "${hint}" && exit 1)'`,
      `sh -c 'cd apps/desktop/desktop_native && cargo +nightly udeps --workspace --all-features --all-targets || (echo "${hint}" && exit 1)'`,
      `sh -c 'cd apps/desktop/desktop_native && cargo deny --log-level error --all-features check all || (echo "${hint}" && exit 1)'`,
    ];
  },
};
