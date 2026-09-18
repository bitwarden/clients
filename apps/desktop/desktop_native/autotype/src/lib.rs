mod app_data;
pub mod mvp; // MVP, delete with PM-41067

pub use app_data::{
    path::{build_normalizer, PathNormalizer, PlatformPolicy},
    running_apps::{get_active_app, get_running_apps},
    AppData, AppMetadata, VerifiableAppData,
};
