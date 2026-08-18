mod app_data;
pub mod mvp; // MVP, delete with PM-41067

pub use app_data::path::{build_normalizer, PathNormalizer, PlatformPolicy};
pub use app_data::running_apps::get_running_apps;
pub use app_data::AppData;
