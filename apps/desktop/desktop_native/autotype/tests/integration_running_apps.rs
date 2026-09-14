#![cfg(target_os = "windows")]

use std::{thread, time::Duration};

use autotype::{get_active_app, get_running_apps};

/// Install a fmt subscriber that routes through cargo's test capture (so `--nocapture` shows it)
/// and honors `RUST_LOG`.
fn init_tracing() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_test_writer()
        .try_init();
}

/// Manual, print-only integration check for the running-apps enumeration.
///
/// Runs the real [`autotype::get_running_apps`] pipeline against whatever is currently running on
/// the machine and prints the results as a table.
/// It makes no assertions, this is a developer tool to eyeball what the enumeration returns, so it
/// must be run on a Windows machine that already has a normal set of apps open.
///
/// ```text
/// RUST_LOG=debug cargo test -p autotype --test integration_running_apps -- --ignored --nocapture
/// ```
#[test]
#[ignore = "manual: result is compared against actuall running apps on the system. "]
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

    println!("  {:<name_w$}  PATH", "NAME");
    println!("  {:<name_w$}  ----", "-".repeat(name_w));
    for a in &apps {
        println!("  {:<name_w$}  {}", a.display_name, a.path.display());
    }
    println!();
}

/// Manual capture of the active (foreground) app. Launching the test focuses the terminal, so this
/// waits 10 seconds first: alt-tab to the app you want to capture during the countdown, then it
/// samples `get_active_app()` once and prints the result.
///
/// ```text
/// RUST_LOG=debug cargo test -p autotype --test active_app_after_delay -- --ignored --nocapture
/// ```
#[test]
#[ignore = "manual: needs a human operator in a desktop env to surface a "]
#[allow(clippy::print_stdout)]
fn active_app_after_delay() {
    init_tracing();

    const DELAY_SECS: u64 = 10;
    println!();
    println!(
        "Switch focus to the app you want to capture — sampling get_active_app() in {DELAY_SECS}s..."
    );
    thread::sleep(Duration::from_secs(DELAY_SECS));

    match get_active_app() {
        Ok(app) => {
            println!("Active app:");
            println!("  NAME: {}", app.display_name);
            println!("  PATH: {}", app.path.display());
        }
        Err(e) => println!("get_active_app() returned an error: {e:#}"),
    }
    println!();
}
