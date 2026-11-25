#[napi]
pub mod autotype {
    /// A running application that can be paired with a login for Autotype.
    ///
    /// Holds the app's name and path, which can include the user's name, so it must never be
    /// logged.
    #[napi(object)]
    pub struct RunningApp {
        /// Human-readable name for the app, e.g. `Google Chrome`.
        pub name: String,
        /// Normalized absolute path to the app's executable, e.g.
        /// `%LOCALAPPDATA%\App\app.exe`.
        pub path: String,
    }

    /// Lists the running, user-facing applications, sorted by name.
    ///
    /// Returns an empty list on platforms other than Windows, where Autotype isn't supported.
    #[napi]
    #[cfg_attr(not(windows), allow(clippy::unused_async))]
    pub async fn get_running_apps() -> napi::Result<Vec<RunningApp>> {
        #[cfg(windows)]
        {
            // Listing the apps blocks on COM calls, so it runs off the JavaScript thread
            let apps = tokio::task::spawn_blocking(::autotype::get_running_apps)
                .await
                .map_err(|e| {
                    napi::Error::from_reason(format!("Failed to list the running apps: {e}"))
                })??;

            Ok(apps
                .into_iter()
                .map(|app| RunningApp {
                    name: app.display_name,
                    path: app.path.to_string_lossy().into_owned(),
                })
                .collect())
        }

        #[cfg(not(windows))]
        {
            Ok(Vec::new())
        }
    }
}
