//! Source B: running **packaged** apps, via the documented WinRT `AppDiagnosticInfo` API.
//!
//! Pure FFI *acquisition*: it enumerates running packaged apps into plain-data
//! [`super::RunningPackagedApp`]s. It knows nothing about window enumeration or the combined app
//! set — merging Source B into the window-derived entries is [`super::merge_packaged`]'s job.
//!
//! Identifies packaged apps that are running but keep no real top-level window when
//! backgrounded (Teams, Copilot). This is possible because `AppDiagnosticInfo` lists
//! *all* running packaged apps, including system shell surface (Start, Search,
//! Widgets, …).

use windows::System::{AppDiagnosticInfo, DiagnosticAccessStatus};

use super::RunningPackagedApp;

/// Enumerate running packaged apps. Never panics; returns empty on denial or any WinRT error
/// (callers then rely on window enumeration alone).
pub(super) fn running_packaged_apps() -> Vec<RunningPackagedApp> {
    enumerate().unwrap_or_default()
}

fn enumerate() -> windows::core::Result<Vec<RunningPackagedApp>> {
    if AppDiagnosticInfo::RequestAccessAsync()?.join()? != DiagnosticAccessStatus::Allowed {
        return Ok(Vec::new());
    }

    let infos = AppDiagnosticInfo::RequestInfoAsync()?.join()?;
    let mut out = Vec::new();
    for info in infos {
        let Ok(app) = info.AppInfo() else { continue };
        let aumid = app
            .AppUserModelId()
            .map(|s| s.to_string())
            .unwrap_or_default();
        if aumid.is_empty() {
            continue;
        }
        // Empty display names are treated as absent so they never surface as a blank name.
        let display_name = app
            .DisplayInfo()
            .and_then(|d| d.DisplayName())
            .map(|s| s.to_string())
            .ok()
            .filter(|s| !s.is_empty());

        out.push(RunningPackagedApp {
            aumid,
            display_name,
            pids: pids_of(&info),
        });
    }
    Ok(out)
}

/// The PIDs backing an app, via its resource groups' process diagnostic infos.
fn pids_of(info: &AppDiagnosticInfo) -> Vec<u32> {
    let mut pids = Vec::new();
    if let Ok(groups) = info.GetResourceGroups() {
        for group in groups {
            if let Ok(procs) = group.GetProcessDiagnosticInfos() {
                for proc in procs {
                    if let Ok(pid) = proc.ProcessId() {
                        pids.push(pid);
                    }
                }
            }
        }
    }
    pids
}
