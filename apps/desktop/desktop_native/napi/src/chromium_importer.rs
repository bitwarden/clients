#[napi]
pub mod chromium_importer {
    use std::collections::HashMap;

    use chromium_importer::{
        chromium::{
            DefaultInstalledBrowserRetriever, LoginImportResult as _LoginImportResult,
            ProfileInfo as _ProfileInfo,
        },
        metadata::NativeImporterMetadata as _NativeImporterMetadata,
    };

    #[napi(object)]
    pub struct ProfileInfo {
        pub id: String,
        pub name: String,
    }

    #[napi(object)]
    pub struct Login {
        pub url: String,
        pub username: String,
        pub password: String,
        pub note: String,
    }

    #[napi(object)]
    pub struct LoginImportFailure {
        pub url: String,
        pub username: String,
        pub error: String,
    }

    #[napi(object)]
    pub struct LoginImportResult {
        pub login: Option<Login>,
        pub failure: Option<LoginImportFailure>,
    }

    #[napi(object)]
    pub struct NativeImporterMetadata {
        pub id: String,
        pub loaders: Vec<String>,
        pub instructions: String,
    }

    /// Pre-translated picker dialog strings supplied by the renderer.
    #[napi(object)]
    pub struct PickerStrings {
        pub message: String,
        pub expected_location_label: String,
        pub prompt: String,
    }

    #[cfg(target_os = "macos")]
    impl From<PickerStrings> for chromium_importer::chromium::PickerStrings {
        fn from(p: PickerStrings) -> Self {
            Self {
                message: p.message,
                expected_location_label: p.expected_location_label,
                prompt: p.prompt,
            }
        }
    }

    impl From<_LoginImportResult> for LoginImportResult {
        fn from(l: _LoginImportResult) -> Self {
            match l {
                _LoginImportResult::Success(l) => LoginImportResult {
                    login: Some(Login {
                        url: l.url,
                        username: l.username,
                        password: l.password,
                        note: l.note,
                    }),
                    failure: None,
                },
                _LoginImportResult::Failure(l) => LoginImportResult {
                    login: None,
                    failure: Some(LoginImportFailure {
                        url: l.url,
                        username: l.username,
                        error: l.error,
                    }),
                },
            }
        }
    }

    impl From<_ProfileInfo> for ProfileInfo {
        fn from(p: _ProfileInfo) -> Self {
            ProfileInfo {
                id: p.folder,
                name: p.name,
            }
        }
    }

    impl From<_NativeImporterMetadata> for NativeImporterMetadata {
        fn from(m: _NativeImporterMetadata) -> Self {
            NativeImporterMetadata {
                id: m.id,
                loaders: m.loaders,
                instructions: m.instructions,
            }
        }
    }

    #[napi]
    /// Returns OS aware metadata describing supported Chromium based importers as a JSON string.
    pub fn get_metadata(mas_build: bool) -> HashMap<String, NativeImporterMetadata> {
        chromium_importer::metadata::get_supported_importers::<DefaultInstalledBrowserRetriever>(
            mas_build,
        )
        .into_iter()
        .map(|(browser, metadata)| (browser, NativeImporterMetadata::from(metadata)))
        .collect()
    }

    #[napi]
    pub async fn get_available_profiles(
        browser: String,
        mas_build: bool,
    ) -> napi::Result<Vec<ProfileInfo>> {
        chromium_importer::chromium::get_available_profiles(&browser, mas_build)
            .await
            .map(|profiles| profiles.into_iter().map(ProfileInfo::from).collect())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn import_logins(
        browser: String,
        profile_id: String,
        mas_build: bool,
    ) -> napi::Result<Vec<LoginImportResult>> {
        chromium_importer::chromium::import_logins(&browser, &profile_id, mas_build)
            .await
            .map(|logins| logins.into_iter().map(LoginImportResult::from).collect())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    #[allow(clippy::unused_async)]
    pub async fn request_browser_access(
        _browser: String,
        _picker_strings: PickerStrings,
        _mas_build: bool,
    ) -> napi::Result<()> {
        #[cfg(target_os = "macos")]
        return chromium_importer::chromium::request_browser_access(
            &_browser,
            _picker_strings.into(),
            _mas_build,
        )
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()));

        #[cfg(not(target_os = "macos"))]
        Ok(())
    }
}
