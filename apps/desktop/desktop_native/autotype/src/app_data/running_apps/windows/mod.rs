//! Windows implementation of getting running apps.
//!
//! Order of operations:
//!    1. collect raw running apps list
//!    2. filter out the noise
//!    3. sort alphabetically by display name

use std::{collections::HashMap, path::PathBuf};

use tracing::{debug, warn};
use windows::{
    core::GUID,
    Win32::{
        Foundation::{PROPERTYKEY, RPC_E_CHANGED_MODE},
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
    },
};

use crate::app_data::AppData;

mod appsfolder;
mod collect;
mod filter;

// `PKEY_AppUserModel_ID` (propkey.h): fmtid `{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}`, pid 5.
// Not published by the `windows` crate, hence hard-coding.
// <https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id>
const PKEY_APP_USER_MODEL_ID: PROPERTYKEY = PROPERTYKEY {
    fmtid: GUID::from_u128(0x9F4C2855_9F79_4B39_A8D0_E1D42DE1D5F3),
    pid: 5,
};

/// The `ApplicationFrameHost` host process. Packaged/UWP apps present their frame window under it;
/// `collect::window_source` follows the frame to the hosted child, and `filter` drops it as shell
/// surface when that child-follow fails. Shared so the two decisions can't drift.
const APPLICATION_FRAME_HOST_EXE: &str = "applicationframehost.exe";

/// One registered application from the AppsFolder, as identity + display name. Produced by
/// [`appsfolder`] and consumed by [`collect`] to resolve window/process identity. `display_name`
/// is `None` when the shell reports no (or an empty) name, so consumers fall back rather than
/// surfacing a blank name.
struct AppRegistration {
    display_name: Option<String>,
}

/// AppsFolder contents keyed on **lowercased** AUMID.
type AppRegistry = HashMap<String, AppRegistration>;

/// Internal working record for one running application in Windows.
/// Contains everything the collection and filtering stages need.
struct RunningApp {
    /// A representative process id for the app (apps may span many processes).
    pid: u32,
    /// Raw executable file name, e.g. `chrome.exe`.
    filename: String,
    /// Friendly name resolved from the AppsFolder registry or version info, if any.
    display_name: Option<String>,
    /// Full path to the executable, when it could be resolved.
    exe_path: Option<PathBuf>,
    /// Came from a true top-level window.
    has_window: bool,
    /// The app is registered/user-launchable (its AUMID is in the AppsFolder registry).
    registered: bool,
}

impl RunningApp {
    /// The best human-readable label available for this app.
    fn name(&self) -> &str {
        self.display_name.as_deref().unwrap_or(&self.filename)
    }

    fn into_app_data(self) -> AppData {
        AppData {
            display_name: self.name().to_owned(),
            path: self.exe_path,
        }
    }
}

/// Windows implementation of [`super::get_running_apps`]. Infallible — collection and
/// filtering degrade to empty/skip on any OS-query failure.
///
/// Reading window property stores / AppsFolder / AppDiagnosticInfo needs COM, so this
/// initializes a single-threaded apartment (STA) for the duration of the call and balances it
/// with a matching `CoUninitialize`.
///
/// If the calling thread was already initialized in a
/// different apartment (`RPC_E_CHANGED_MODE`) COM stays usable in that apartment and no
/// reference is released; any other initialization failure leaves the shell/WinRT calls to
/// fail their `Result`s, degrading to an empty list.
pub(super) fn get_running_apps() -> Vec<AppData> {
    // S_OK / S_FALSE add an initialization reference on this thread that we own and must
    // release; RPC_E_CHANGED_MODE does not (the thread keeps its existing apartment).
    let hr_result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };

    let owns_com = hr_result.is_ok();
    if !owns_com && hr_result != RPC_E_CHANGED_MODE {
        warn!(
            ?hr_result,
            "CoInitializeEx failed; running-app enumeration may be empty"
        );
    }

    let apps = enumerate();

    if owns_com {
        // SAFETY: only run on successful CoInitializeEx result.
        unsafe { CoUninitialize() };
    }

    apps
}

/// Collect → filter → sort → reduce to the public [`AppData`] shape.
///
/// # Safety COM must first be initialized by the caller.
fn enumerate() -> Vec<AppData> {
    // The authoritative set of registered launchable apps, keyed by AUMID — the input that
    // lets collection resolve real identities and tag user-launchable apps.
    let registry = appsfolder::load();

    // 1. Collection: the raw, full list of running apps.
    // This contains many processes that are not actually apps that can be paired.
    let raw = collect::collect(&registry);
    let n_collected = raw.len();

    debug!(n = n_collected, "Collected raw running apps.");

    // 2. Filtering: apply the exclusion policy (dropped candidates are logged, not returned).
    let mut kept = filter::apply(raw);

    // 3. Sort: alphabetically by name ensure deterministic output
    kept.sort_by(|a, b| {
        a.name()
            .to_ascii_lowercase()
            .cmp(&b.name().to_ascii_lowercase())
    });

    debug!(
        n_filtered = n_collected - kept.len(),
        n_kept = kept.len(),
        "Filtered running apps."
    );

    // 4. Convert: the raw type to the public API
    kept.into_iter().map(RunningApp::into_app_data).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn running(name: &str, display: Option<&str>, path: Option<&str>) -> RunningApp {
        RunningApp {
            pid: 1,
            filename: name.to_string(),
            exe_path: path.map(PathBuf::from),
            display_name: display.map(str::to_owned),
            has_window: true,
            registered: false,
        }
    }

    #[test]
    fn label_prefers_display_name() {
        assert_eq!(
            running("chrome.exe", Some("Google Chrome"), None).name(),
            "Google Chrome"
        );
    }

    #[test]
    fn label_falls_back_to_name() {
        assert_eq!(running("chrome.exe", None, None).name(), "chrome.exe");
    }

    #[test]
    fn into_app_data_uses_label_and_path() {
        let data = running(
            "chrome.exe",
            Some("Google Chrome"),
            Some("C:\\c\\chrome.exe"),
        )
        .into_app_data();
        assert_eq!(data.display_name, "Google Chrome");
        assert_eq!(data.path, Some(PathBuf::from("C:\\c\\chrome.exe")));
    }
}
