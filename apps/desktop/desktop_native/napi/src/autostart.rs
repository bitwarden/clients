#[napi]
pub mod autostart {
    #[napi]
    pub async fn set_autostart(autostart: bool, params: Vec<String>) -> napi::Result<()> {
        desktop_core::autostart::set_autostart(autostart, params)
            .await
            .map_err(|e| napi::Error::from_reason(format!("Error setting autostart - {e} - {e:?}")))
    }
}
