use anyhow::Result;

/// # Errors
///
/// This function errors if any error occurs while executing
/// the `ObjC` command, or if converting the `value` argument
/// into a `CString`.
pub async fn run_command(value: String) -> Result<String> {
    desktop_objc::run_command(value).await
}
