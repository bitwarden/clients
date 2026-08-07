// MVP, delete with PM-41067
#[napi]
pub mod autotype_mvp {
    #[napi]
    pub fn get_foreground_window_title() -> napi::Result<String> {
        Ok(autotype::mvp::get_foreground_window_title()?)
    }

    #[napi]
    pub fn type_input(
        input: Vec<u16>,
        keyboard_shortcut: Vec<String>,
    ) -> napi::Result<(), napi::Status> {
        Ok(autotype::mvp::type_input(&input, &keyboard_shortcut)?)
    }
}
