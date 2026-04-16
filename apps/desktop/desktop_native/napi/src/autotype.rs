#[napi]
pub mod autotype {
    #[napi]
    pub fn get_foreground_window_title() -> napi::Result<String> {
        Ok(autotype::get_foreground_window_title()?)
    }

    #[napi]
    pub fn type_input(
        input: Vec<u16>,
        keyboard_shortcut: Vec<String>,
    ) -> napi::Result<(), napi::Status> {
        Ok(autotype::type_input(&input, &keyboard_shortcut)?)
    }
}
