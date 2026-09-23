#[napi]
pub mod autostart {
    #[napi(object)]
    pub struct AutostartConfig {
        pub exec_path: String,
        pub autostart_flag: String,
    }

    impl From<AutostartConfig> for desktop_core::autostart::AutostartConfig {
        fn from(config: AutostartConfig) -> Self {
            desktop_core::autostart::AutostartConfig {
                exec_path: config.exec_path,
                autostart_flag: config.autostart_flag,
            }
        }
    }

    #[napi]
    pub async fn set_autostart(enabled: bool, config: AutostartConfig) -> napi::Result<()> {
        desktop_core::autostart::set_autostart(enabled, config.into())
            .await
            .map_err(|e| napi::Error::from_reason(format!("Error setting autostart: {e:?}")))
    }
}
