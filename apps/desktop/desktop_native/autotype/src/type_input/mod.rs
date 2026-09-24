//! Type input into the foreground application — autotype's "type the credential" step.

#[cfg(windows)]
mod windows;

/// Types `input` (utf-16 encoded characters) wherever the cursor is, releasing the given
/// keyboard-shortcut keys first.
///
/// Windows-only: there is no non-Windows implementation (autotype is unsupported there, and the
/// only caller — `execute_autotype` — is itself gated to Windows).
#[cfg(windows)]
pub(crate) fn type_input(input: &[u16], keyboard_shortcut: &[String]) -> anyhow::Result<()> {
    windows::type_input(input, keyboard_shortcut)
}
