#[napi]
pub mod autotype {
    #[napi]
    pub fn get_foreground_window_title() -> napi::Result<String> {
        autotype::get_foreground_window_title().map_err(|_| {
            napi::Error::from_reason(
                "Autotype Error: failed to get foreground window title".to_string(),
            )
        })
    }

    #[napi]
    pub fn type_input(
        input: Vec<u16>,
        keyboard_shortcut: Vec<String>,
    ) -> napi::Result<(), napi::Status> {
        autotype::type_input(&input, &keyboard_shortcut)
            .map_err(|e| napi::Error::from_reason(format!("Autotype Error: {e}")))
    }
}
