pub fn get_foreground_window_title() -> anyhow::Result<String> {
    todo!("Bitwarden does not yet support macOS autotype");
}

pub fn type_input(_input: &[u16], _keyboard_shortcut: &[String]) -> anyhow::Result<()> {
    todo!("Bitwarden does not yet support macOS autotype");
}

pub fn get_foreground_window_handle() -> anyhow::Result<Vec<u8>> {
    todo!("Bitwarden does not yet support macOS autotype");
}

pub fn focus_window(_hwnd: Vec<u8>, _settle: bool) -> anyhow::Result<()> {
    todo!("Bitwarden does not yet support macOS autotype");
}
