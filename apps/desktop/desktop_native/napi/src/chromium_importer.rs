#[napi]
pub mod chromium_importer {
    use std::collections::HashMap;

    use chromium_importer::{
        chromium::{
            DefaultInstalledBrowserRetriever, Login, LoginImportFailure,
            LoginImportResult as _LoginImportResult, ProfileInfo as _ProfileInfo,
        },
        metadata::NativeImporterMetadata,
    };

    #[napi(object)]
    pub struct ProfileInfo {
        pub id: String,
        pub name: String,
    }

    #[napi(object)]
    pub struct LoginImportResult {
        pub login: Option<Login>,
        pub failure: Option<LoginImportFailure>,
    }

    impl From<_LoginImportResult> for LoginImportResult {
        fn from(l: _LoginImportResult) -> Self {
            match l {
                _LoginImportResult::Success(l) => LoginImportResult {
                    login: Some(l),
                    failure: None,
                },
                _LoginImportResult::Failure(l) => LoginImportResult {
                    login: None,
                    failure: Some(l),
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

    #[napi]
    /// Returns OS aware metadata describing supported Chromium based importers as a JSON string.
    pub fn get_metadata() -> HashMap<String, NativeImporterMetadata> {
        chromium_importer::metadata::get_supported_importers::<DefaultInstalledBrowserRetriever>()
    }

    #[napi]
    pub fn get_available_profiles(browser: String) -> napi::Result<Vec<ProfileInfo>> {
        chromium_importer::chromium::get_available_profiles(&browser)
            .map(|profiles| profiles.into_iter().map(ProfileInfo::from).collect())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn import_logins(
        browser: String,
        profile_id: String,
    ) -> napi::Result<Vec<LoginImportResult>> {
        chromium_importer::chromium::import_logins(&browser, &profile_id)
            .await
            .map(|logins| logins.into_iter().map(LoginImportResult::from).collect())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
