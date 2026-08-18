//! Manual, print-only integration check for the running-apps enumeration.
//!
//! Runs the real [`autotype::get_running_apps`] pipeline against whatever is currently running on
//! the machine and prints the results as a table.
//! It makes no assertions, this is a developer tool to eyeball what the enumeration returns, so it must be run on a Windows machine that
//! already has a normal set of apps open.
//!
//! ```text
//! RUST_LOG=debug cargo test -p autotype --test integration_running_apps -- --nocapture
//! ```
#![cfg(target_os = "windows")]

use std::path::PathBuf;

use autotype::get_running_apps;

/// Install a fmt subscriber that routes through cargo's test capture (so `--nocapture` shows it)
/// and honors `RUST_LOG`.
fn init_tracing() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_test_writer()
        .try_init();
}

#[test]
#[allow(clippy::print_stdout)]
fn print_running_apps() {
    init_tracing();
    let apps = get_running_apps().expect("get_running_apps should succeed on Windows");

    println!();
    println!("Running user-facing apps — {} app(s)", apps.len());
    println!();

    if apps.is_empty() {
        println!("  (none)");
        return;
    }

    // Size the NAME column to the widest display name (min. the header width).
    let name_w = apps
        .iter()
        .map(|a| a.display_name.len())
        .max()
        .unwrap_or(4)
        .max(4);

    println!("  {:<name_w$}  {}", "NAME", "PATH");
    println!("  {:<name_w$}  {}", "-".repeat(name_w), "----");
    for a in &apps {
        println!(
            "  {:<name_w$}  {}",
            a.display_name,
            path_or_unknown(&a.path)
        );
    }
    println!();
}

fn path_or_unknown(path: &Option<PathBuf>) -> String {
    path.as_deref()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| "<unknown>".to_string())
}
