//! Manual, interactive integration check for `execute_autotype`.
#![cfg(target_os = "windows")]

use std::{thread, time::Duration};

use autotype::{execute_autotype, get_active_app};

/// Route tracing through cargo's test capture (shown with `--nocapture`) and honor `RUST_LOG`.
fn init_tracing() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_test_writer()
        .try_init();
}

/// Waits and captures the active app, then waits AGAIN before autotyping into whatever is active at
/// that point — so during the second wait you can STAY on the app (success path) or SWITCH to a
/// different app (error path: re-verification fails and nothing is typed)
///
/// # Warning
///
/// Injects keystrokes into the focused window.
///
/// ```text
/// RUST_LOG=debug cargo test -p autotype --test integration_execute_autotype execute_autotype_types_into_focused_field -- --ignored --nocapture
/// ```
#[test]
#[ignore = "manual: focus a text field during the countdown; this injects keystrokes"]
#[allow(clippy::print_stdout)]
fn execute_autotype_types_into_focused_field() {
    init_tracing();

    const CAPTURE_DELAY_SECS: u64 = 10;
    const REVERIFY_DELAY_SECS: u64 = 10;

    println!();
    println!("Focus the app to verify — capturing the active app in {CAPTURE_DELAY_SECS}s...");
    thread::sleep(Duration::from_secs(CAPTURE_DELAY_SECS));

    let expected = get_active_app().expect("should capture the active app");
    println!(
        "Captured active app: {} (id={}, pid={})",
        expected.app_data.display_name, expected.app_metadata.id, expected.app_metadata.pid
    );

    println!(
        "Now STAY on that app for the success path, or SWITCH to a different app for the error path \
         — calling execute_autotype in {REVERIFY_DELAY_SECS}s..."
    );
    thread::sleep(Duration::from_secs(REVERIFY_DELAY_SECS));

    // utf-16 encoding of "test"; no modifier keys to release.
    let input: Vec<u16> = "test".encode_utf16().collect();
    match execute_autotype(expected, &input, &[]) {
        Ok(()) => println!("execute_autotype OK — same app still active; 'test' should be typed."),
        Err(e) => println!("execute_autotype failed (expected if you switched apps): {e:#}"),
    }
    println!();
}
