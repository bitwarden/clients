//! Filtering: apply the filtering policy to the raw running-app list.
//!
//! Each rule is a self-contained [`FilterStep`], run in the order given by [`PIPELINE`].

use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
};

use tracing::debug;
use windows::Win32::System::Threading::GetCurrentProcessId;

use super::{RunningApp, APPLICATION_FRAME_HOST_EXE};

/// Runtime input a step may need that can't be baked into the `static` pipeline — currently just
/// our own process id, read once per [`apply`] call.
struct FilterCtx {
    self_pid: u32,
}

/// One self-contained filtering rule. Returns `true` to KEEP the candidate. `Sync` so the whole
/// pipeline can live in a `static` (every step is a stateless zero-sized type).
trait FilterStep: Sync {
    fn name(&self) -> &'static str;
    fn keep(&self, candidate: &RunningApp, ctx: &FilterCtx) -> bool;
}

/// The ordered filter exclusion pipeline. Fully static: the steps are stateless ZSTs, so this is
/// one shared slice of trait objects with no per-call allocation. Any runtime input (our pid) is
/// threaded in through [`FilterCtx`].
static PIPELINE: &[&dyn FilterStep] = &[
    &ExcludeUnlabeled,
    &ExcludeSelf,
    &ExcludeSystemPaths,
    &ExcludeShellSurface,
    &ExcludeUnregisteredBackground,
    &ExcludeBackgroundNoise,
];

/// Run every filter step in order and return the kept apps.
pub(super) fn apply(candidates: Vec<RunningApp>) -> Vec<RunningApp> {
    let ctx = FilterCtx {
        self_pid: unsafe { GetCurrentProcessId() },
    };

    let mut kept = candidates;

    for step in PIPELINE {
        let before = kept.len();
        let (pass, dropped): (Vec<RunningApp>, Vec<RunningApp>) =
            kept.into_iter().partition(|c| step.keep(c, &ctx));
        for c in &dropped {
            debug!(step = step.name(), app = c.name(), "removed");
        }
        kept = pass;
        debug!(
            step = step.name(),
            before,
            after = kept.len(),
            "step complete"
        );
    }

    kept
}

/// Drop candidates with no usable label. An app we can't name isn't a pairable target and would
/// otherwise surface as a blank row — e.g. a windowless packaged app whose WinRT display name is
/// absent and whose process path can't be resolved, or a window whose AUMID/product/exe all fail
/// to resolve. Enforced here (policy) since collection stays inclusive.
struct ExcludeUnlabeled;
impl FilterStep for ExcludeUnlabeled {
    fn name(&self) -> &'static str {
        "exclude-unlabeled"
    }
    fn keep(&self, c: &RunningApp, _ctx: &FilterCtx) -> bool {
        !c.name().trim().is_empty()
    }
}

/// Drop our own process.
struct ExcludeSelf;
impl FilterStep for ExcludeSelf {
    fn name(&self) -> &'static str {
        "exclude-self"
    }
    fn keep(&self, c: &RunningApp, ctx: &FilterCtx) -> bool {
        c.pid != ctx.self_pid
    }
}

/// Drop executables under `%SystemRoot%` (Task Manager, system UI, File Explorer, etc.).
struct ExcludeSystemPaths;
impl FilterStep for ExcludeSystemPaths {
    fn name(&self) -> &'static str {
        "exclude-system-paths"
    }
    fn keep(&self, c: &RunningApp, _ctx: &FilterCtx) -> bool {
        match &c.exe_path {
            Some(p) => !is_under_system_root(p),
            None => true,
        }
    }
}

/// Drop OS shell surface that owns titled top-level windows but is not a user app
/// (Explorer/Progman, Start, Search, the packaged-app host, Widgets, …). Mostly redundant
/// with `ExcludeSystemPaths`, but catches shell surface under `Program Files\WindowsApps`.
struct ExcludeShellSurface;
impl FilterStep for ExcludeShellSurface {
    fn name(&self) -> &'static str {
        "exclude-shell-surface"
    }
    fn keep(&self, c: &RunningApp, _ctx: &FilterCtx) -> bool {
        const SHELL_SURFACE: &[&str] = &[
            "explorer.exe",
            APPLICATION_FRAME_HOST_EXE,
            "searchhost.exe",
            "startmenuexperiencehost.exe",
            "shellexperiencehost.exe",
            "textinputhost.exe",
            "widgets.exe",
        ];
        !name_matches(&c.filename, SHELL_SURFACE)
    }
}

/// Drop windowless candidates that aren't registered/user-launchable. This removes the system
/// shell surface that `AppDiagnosticInfo` returns (Start, Search, Shell Experience Host,
/// Widgets, WinGet COM Server, …) while keeping windowless *registered* apps (Teams, Copilot)
/// and every window-backed app (which is exempt regardless of registration).
struct ExcludeUnregisteredBackground;
impl FilterStep for ExcludeUnregisteredBackground {
    fn name(&self) -> &'static str {
        "exclude-unregistered-background"
    }
    fn keep(&self, c: &RunningApp, _ctx: &FilterCtx) -> bool {
        c.has_window || c.registered
    }
}

/// User-installed background helpers/telemetry that *do* present a real window but are never
/// autotype/pairing targets. Listed explicitly. Longer term, a UI-Automation tray-icon signal
/// (real apps have a tray icon; these helpers do not) would slot in as exactly this one step,
/// leaving everything upstream untouched.
struct ExcludeBackgroundNoise;
impl FilterStep for ExcludeBackgroundNoise {
    fn name(&self) -> &'static str {
        "exclude-background-noise"
    }
    fn keep(&self, c: &RunningApp, _ctx: &FilterCtx) -> bool {
        const BACKGROUND_NOISE: &[&str] = &[
            "vctip.exe",                       // Visual C++ telemetry uploader
            "onedrive.sync.service.exe",       // OneDrive sync helper (folds into OneDrive)
            "windowspackagemanagerserver.exe", // WinGet COM server (WingetMessageOnlyWindow)
        ];
        !name_matches(&c.filename, BACKGROUND_NOISE)
    }
}

fn name_matches(name: &str, list: &[&str]) -> bool {
    let lc = name.to_ascii_lowercase();
    list.contains(&lc.as_str())
}

/// Is the executable under `%SystemRoot%` (typically `C:\Windows`)?
fn is_under_system_root(path: &Path) -> bool {
    match std::env::var_os("SystemRoot").or_else(|| std::env::var_os("windir")) {
        Some(root) => is_under_root(path, &root),
        None => false,
    }
}

/// Case-insensitive, component-aware "is `path` under `system_root`?" — split out from the env
/// lookup so it can be unit-tested without touching global environment variables.
fn is_under_root(path: &Path, system_root: &OsStr) -> bool {
    // Compare on component boundaries so a sibling like `C:\Windows.old\…` does NOT match
    // `C:\Windows`, and lowercase both sides first since Windows paths are case-insensitive
    // (`Path::starts_with` itself is case-sensitive).
    let root = PathBuf::from(system_root.to_string_lossy().to_ascii_lowercase());
    let path = PathBuf::from(path.to_string_lossy().to_ascii_lowercase());
    path.starts_with(&root)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(
        pid: u32,
        name: &str,
        exe_path: Option<&str>,
        has_window: bool,
        registered: bool,
    ) -> RunningApp {
        RunningApp {
            pid,
            filename: name.to_string(),
            exe_path: exe_path.map(PathBuf::from),
            display_name: None,
            has_window,
            registered,
        }
    }

    #[test]
    fn exclude_self_drops_only_matching_pid() {
        let step = ExcludeSelf;
        let ctx = FilterCtx { self_pid: 100 };
        assert!(!step.keep(&app(100, "a.exe", None, true, true), &ctx));
        assert!(step.keep(&app(200, "a.exe", None, true, true), &ctx));
    }

    #[test]
    fn exclude_unlabeled_drops_candidates_with_no_usable_name() {
        let step = ExcludeUnlabeled;
        let ctx = FilterCtx { self_pid: 0 };
        // No display name (helper sets it None) and an empty filename → no usable label.
        assert!(!step.keep(&app(1, "", None, true, true), &ctx));
        // Whitespace-only is also unusable.
        assert!(!step.keep(&app(1, "   ", None, true, true), &ctx));
        assert!(step.keep(&app(1, "chrome.exe", None, true, false), &ctx));
    }

    #[test]
    fn is_under_root_is_case_insensitive_and_component_aware() {
        assert!(is_under_root(
            Path::new("C:\\Windows\\System32\\notepad.exe"),
            OsStr::new("C:\\Windows")
        ));
        // Case-insensitive on both sides.
        assert!(is_under_root(
            Path::new("c:\\windows\\x.exe"),
            OsStr::new("C:\\WINDOWS")
        ));
        // Sibling directory must NOT match (component boundary, not raw prefix).
        assert!(!is_under_root(
            Path::new("C:\\Windows.old\\x.exe"),
            OsStr::new("C:\\Windows")
        ));
        // Unrelated path.
        assert!(!is_under_root(
            Path::new("D:\\Apps\\x.exe"),
            OsStr::new("C:\\Windows")
        ));
    }

    #[test]
    fn exclude_system_paths_keeps_non_system_and_pathless() {
        let step = ExcludeSystemPaths;
        let ctx = FilterCtx { self_pid: 0 };
        assert!(step.keep(&app(1, "x.exe", Some("D:\\Apps\\x.exe"), true, false), &ctx));
        assert!(step.keep(&app(1, "x.exe", None, true, false), &ctx));
    }

    #[test]
    fn exclude_shell_surface_matches_case_insensitively() {
        let step = ExcludeShellSurface;
        let ctx = FilterCtx { self_pid: 0 };
        assert!(!step.keep(&app(1, "Explorer.EXE", None, true, false), &ctx));
        assert!(step.keep(&app(1, "chrome.exe", None, true, false), &ctx));
    }

    #[test]
    fn exclude_background_noise_drops_listed_helpers() {
        let step = ExcludeBackgroundNoise;
        let ctx = FilterCtx { self_pid: 0 };
        assert!(!step.keep(&app(1, "vctip.exe", None, true, false), &ctx));
        assert!(step.keep(&app(1, "code.exe", None, true, false), &ctx));
    }

    #[test]
    fn exclude_unregistered_background_keeps_windowed_or_registered() {
        let step = ExcludeUnregisteredBackground;
        let ctx = FilterCtx { self_pid: 0 };
        assert!(!step.keep(&app(1, "x.exe", None, false, false), &ctx));
        assert!(step.keep(&app(1, "x.exe", None, true, false), &ctx));
        assert!(step.keep(&app(1, "x.exe", None, false, true), &ctx));
    }

    #[test]
    fn apply_drops_shell_and_noise_keeps_real_apps() {
        // Pids chosen to not collide with the test process (ExcludeSelf uses the real pid).
        let candidates = vec![
            app(4242, "chrome.exe", Some("D:\\Apps\\chrome.exe"), true, true),
            app(
                4243,
                "explorer.exe",
                Some("D:\\x\\explorer.exe"),
                true,
                false,
            ), // shell surface
            app(4244, "vctip.exe", Some("D:\\x\\vctip.exe"), true, false), // background noise
            app(4245, "helper.exe", None, false, false),                   /* windowless
                                                                            * unregistered */
        ];
        let kept = apply(candidates);
        let names: Vec<&str> = kept.iter().map(|c| c.filename.as_str()).collect();
        assert_eq!(names, vec!["chrome.exe"]);
    }
}
