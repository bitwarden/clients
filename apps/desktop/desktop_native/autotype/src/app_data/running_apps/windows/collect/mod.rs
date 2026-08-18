//! Collection: build the raw list of running apps from two independent sources and compose them.
//!
//! - [`window_source`] — **Source A: top-level windows** (`EnumWindows`) — yields [`RawWindow`]s.
//! - [`packaged_source`] — **Source B: running packaged apps** (`AppDiagnosticInfo`) — yields
//!   [`RunningPackagedApp`]s.
//!
//! Each source is pure FFI acquisition and knows nothing about the other. This module owns the
//! *composition*: it defines the plain-data types the sources produce, folds Source A into the
//! combined set ([`collect_windows`]: dedupe + identity resolution against the AppsFolder
//! registry), then merges Source B by PID ([`merge_packaged`])

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, MAX_PATH};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};

use super::{AppRegistry, RunningApp, APPLICATION_FRAME_HOST_EXE, PKEY_APP_USER_MODEL_ID};

mod packaged_source;
mod window_source;

/// Prefix for the dedupe key of an AUMID-identified app. Shared contract between [`identity`]
/// (window-derived entries) and [`merge_packaged`] (windowless packaged entries) so the two
/// sources dedupe against each other.
const AUMID_KEY_PREFIX: &str = "aumid:";

/// One enumerated app window from [`window_source`], resolved to plain data (no live handles).
/// Defined here (the consumer) so the fold logic can read its fields directly.
pub(super) struct RawWindow {
    pid: u32,
    exe_path: Option<PathBuf>,
    name: String,
    aumid: Option<String>,
    /// Version-info product/description name, pre-read from `exe_path`.
    product_name: Option<String>,
    /// Currently shown on screen (visible and not cloaked).
    visible: bool,
}

/// One running packaged app from [`packaged_source`]: identity (AUMID), friendly name, and the
/// PIDs of its processes (used to merge with window-derived entries). `display_name` is `None`
/// when the shell reports no (or an empty) name.
pub(super) struct RunningPackagedApp {
    aumid: String,
    display_name: Option<String>,
    pids: Vec<u32>,
}

/// Build the raw list of running apps (Source A ∪ Source B), deduped and identity-resolved.
pub(super) fn collect(registry: &AppRegistry) -> Vec<RunningApp> {
    let mut by_key: HashMap<String, RunningApp> = HashMap::new();

    // Source A — top-level windows.
    collect_windows(window_source::app_windows(), registry, &mut by_key);

    // Source B — running packaged apps.
    merge_packaged(
        packaged_source::running_packaged_apps(),
        registry,
        &mut by_key,
    );

    by_key.into_values().collect()
}

/// Fold the enumerated windows into `by_key`, deduped and identity-resolved. FFI-free.
fn collect_windows(
    windows: Vec<RawWindow>,
    registry: &AppRegistry,
    by_key: &mut HashMap<String, RunningApp>,
) {
    // Keys whose representative pid already comes from a visible window. Collection-local: it
    // only guides which pid we keep, and is not needed once collection is done.
    let mut has_visible_representative: HashSet<String> = HashSet::new();

    for w in windows {
        let (display_name, key, registered) = identity(
            w.aumid.as_deref(),
            &w.exe_path,
            &w.name,
            w.product_name.as_deref(),
            registry,
        );

        let entry = by_key.entry(key.clone()).or_insert_with(|| RunningApp {
            pid: w.pid,
            filename: w.name.clone(),
            exe_path: w.exe_path.clone(),
            display_name: display_name.clone(),
            has_window: true,
            registered,
        });

        // Prefer a pid that owns a visible window as the representative. `insert` returns true
        // only for the first visible window seen for this key, so we upgrade at most once. Adopt
        // the visible window's pid, path, AND filename together as one consistent triple — a
        // mismatched filename (e.g. left as `applicationframehost.exe` while the path points at
        // the real app) would make a `filename`-keyed filter drop a real app.
        if w.visible && has_visible_representative.insert(key) {
            entry.pid = w.pid;
            entry.exe_path = w.exe_path.clone();
            entry.filename = w.name.clone();
        }
    }
}

/// Fold running packaged apps into the window-derived set. Each is tagged `registered` (present in
/// the AppsFolder registry) and merged **by PID**: if a window entry already represents one of its
/// processes, enrich that entry; otherwise add it as a windowless candidate (no visible window).
/// Whether a windowless/unregistered entry survives is left to the filter pipeline (collection
/// stays inclusive).
fn merge_packaged(
    packaged: Vec<RunningPackagedApp>,
    registry: &AppRegistry,
    by_key: &mut HashMap<String, RunningApp>,
) {
    for app in packaged {
        let aumid_key = app.aumid.to_ascii_lowercase();
        let registered = registry.contains_key(&aumid_key);

        // Merge by PID into an existing window-derived entry, if any.
        let matched = by_key
            .iter()
            .find(|(_, c)| app.pids.contains(&c.pid))
            .map(|(k, _)| k.clone());

        if let Some(k) = matched {
            if let Some(c) = by_key.get_mut(&k) {
                if c.display_name.is_none() {
                    c.display_name = app.display_name.clone();
                }
                c.registered |= registered;
            }
            continue;
        }

        // Windowless packaged app — running but backgrounded (no visible window).
        let pid = app.pids.first().copied().unwrap_or(0);
        let exe_path = process_image_path(pid);

        // Fall back to the exe file name when the packaged app has no display name, so `filename`
        // (the last-resort label) is still meaningful.
        let filename = app
            .display_name
            .clone()
            .or_else(|| {
                exe_path
                    .as_deref()
                    .and_then(|p| p.file_name())
                    .map(|s| s.to_string_lossy().into_owned())
            })
            .unwrap_or_default();

        by_key.insert(
            format!("{AUMID_KEY_PREFIX}{aumid_key}"),
            RunningApp {
                pid,
                filename,
                exe_path,
                display_name: app.display_name,
                has_window: false,
                registered,
            },
        );
    }
}

/// Compute `(display_name, dedupe_key, registered)` for a window.
///
/// If the window's AUMID **resolves** in the AppsFolder registry, use that registration: a
/// stable key (the AUMID) so distinct apps — including distinct PWAs like Netflix — stay
/// separate, plus the registry's real display name. No browser special-casing: a regular
/// browser window resolves to the browser's own registration, a PWA window to its own.
/// Otherwise fall back to the exe's version-info product name (then exe path, then file name),
/// and mark it unregistered.
///
/// The `aumid:{key}` key format is a shared contract: [`merge_packaged`] builds the same key so a
/// windowless packaged app dedupes against its window-derived entry.
fn identity(
    aumid: Option<&str>,
    exe_path: &Option<PathBuf>,
    name: &str,
    product_name: Option<&str>,
    registry: &AppRegistry,
) -> (Option<String>, String, bool) {
    if let Some(aumid) = aumid {
        let key = aumid.to_ascii_lowercase();
        if let Some(reg) = registry.get(&key) {
            // Registered (stable AUMID key), but if the registry has no display name fall back to
            // the exe's product name rather than surfacing a blank one.
            let display = reg
                .display_name
                .clone()
                .or_else(|| product_name.map(str::to_owned));
            return (display, format!("{AUMID_KEY_PREFIX}{key}"), true);
        }
    }

    let product = product_name.map(str::to_owned);
    let key = product
        .clone()
        .or_else(|| exe_path.as_ref().map(|p| p.display().to_string()))
        .unwrap_or_else(|| name.to_string());

    (product, key, false)
}

/// Resolve a process's full image path (best-effort; fails for protected processes). Shared:
/// both sources map a PID to its executable path.
fn process_image_path(pid: u32) -> Option<PathBuf> {
    // SAFETY: the handle from OpenProcess is closed exactly once below.
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;

    let mut buf = [0u16; MAX_PATH as usize];
    // In/out char count: on input, the capacity of `buf` (MAX_PATH fits a u32).
    let mut size = buf.len() as u32;

    // SAFETY: `buf`/`size` outlive the call; the query only writes into `buf`.
    let result = unsafe {
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut size,
        )
    };
    // SAFETY: `handle` is a live handle from OpenProcess, not used after this.
    let _ = unsafe { CloseHandle(handle) };

    result.ok()?;

    Some(PathBuf::from(String::from_utf16_lossy(
        &buf[..size as usize],
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_data::running_apps::windows::AppRegistration;

    fn registry(entries: &[(&str, &str)]) -> AppRegistry {
        entries
            .iter()
            .map(|(aumid, name)| {
                (
                    aumid.to_string(),
                    AppRegistration {
                        display_name: (!name.is_empty()).then(|| name.to_string()),
                    },
                )
            })
            .collect()
    }

    fn raw(
        pid: u32,
        aumid: Option<&str>,
        name: &str,
        product: Option<&str>,
        visible: bool,
    ) -> RawWindow {
        RawWindow {
            pid,
            exe_path: Some(PathBuf::from(format!("C:\\Apps\\{name}"))),
            name: name.to_string(),
            aumid: aumid.map(str::to_owned),
            product_name: product.map(str::to_owned),
            visible,
        }
    }

    fn packaged(aumid: &str, display: &str, pids: Vec<u32>) -> RunningPackagedApp {
        RunningPackagedApp {
            aumid: aumid.to_string(),
            display_name: (!display.is_empty()).then(|| display.to_string()),
            pids,
        }
    }

    fn window_entry(pid: u32) -> RunningApp {
        RunningApp {
            pid,
            filename: "host.exe".to_string(),
            exe_path: None,
            display_name: None,
            has_window: true,
            registered: false,
        }
    }

    fn fold(windows: Vec<RawWindow>, reg: &AppRegistry) -> HashMap<String, RunningApp> {
        let mut by_key = HashMap::new();
        collect_windows(windows, reg, &mut by_key);
        by_key
    }

    #[test]
    fn identity_resolves_registered_aumid() {
        let reg = registry(&[("netflix.app", "Netflix")]);
        let (display, key, registered) = identity(
            Some("Netflix.App"),
            &Some(PathBuf::from("C:\\x\\app.exe")),
            "app.exe",
            Some("Some Product"),
            &reg,
        );
        assert_eq!(display.as_deref(), Some("Netflix"));
        assert_eq!(key, "aumid:netflix.app");
        assert!(registered);
    }

    #[test]
    fn identity_unregistered_uses_product_name_as_key() {
        let reg = registry(&[]);
        let (display, key, registered) = identity(
            Some("unknown.aumid"),
            &Some(PathBuf::from("C:\\x\\app.exe")),
            "app.exe",
            Some("Cool App"),
            &reg,
        );
        assert_eq!(display.as_deref(), Some("Cool App"));
        assert_eq!(key, "Cool App");
        assert!(!registered);
    }

    #[test]
    fn identity_falls_back_to_path_then_name() {
        let reg = registry(&[]);
        let (display, key, _) = identity(
            None,
            &Some(PathBuf::from("C:\\x\\app.exe")),
            "app.exe",
            None,
            &reg,
        );
        assert_eq!(display, None);
        assert_eq!(key, PathBuf::from("C:\\x\\app.exe").display().to_string());

        let (_, key_name, _) = identity(None, &None, "app.exe", None, &reg);
        assert_eq!(key_name, "app.exe");
    }

    // --- collect_windows (plain data) ---

    #[test]
    fn collect_dedupes_windows_sharing_an_aumid_and_prefers_visible_pid() {
        let reg = registry(&[("netflix.app", "Netflix")]);
        let by_key = fold(
            vec![
                raw(10, Some("Netflix.App"), "msedge.exe", None, false),
                raw(20, Some("Netflix.App"), "msedge.exe", None, true),
            ],
            &reg,
        );
        assert_eq!(by_key.len(), 1);
        let app = by_key
            .get("aumid:netflix.app")
            .expect("entry keyed by aumid");
        assert_eq!(app.display_name.as_deref(), Some("Netflix"));
        assert!(app.registered);
        // Representative upgraded to the first visible window's pid.
        assert_eq!(app.pid, 20);
    }

    #[test]
    fn collect_keeps_first_visible_representative() {
        let reg = registry(&[("a.app", "A")]);
        let by_key = fold(
            vec![
                raw(10, Some("A.App"), "a.exe", None, true),
                raw(20, Some("A.App"), "a.exe", None, true),
            ],
            &reg,
        );
        assert_eq!(by_key.get("aumid:a.app").expect("entry").pid, 10);
    }

    #[test]
    fn collect_keeps_distinct_unregistered_apps_separate() {
        let reg = registry(&[]);
        let by_key = fold(
            vec![
                raw(10, None, "a.exe", Some("App A"), true),
                raw(20, None, "b.exe", Some("App B"), true),
            ],
            &reg,
        );
        assert_eq!(by_key.len(), 2);
        assert!(by_key.contains_key("App A"));
        assert!(by_key.contains_key("App B"));
    }

    // --- merge_packaged (plain data) ---

    #[test]
    fn merge_enriches_existing_entry_by_pid() {
        let mut by_key = HashMap::new();
        by_key.insert("aumid:teams.app".to_string(), window_entry(500));

        merge_packaged(
            vec![packaged("Teams.App", "Microsoft Teams", vec![500])],
            &registry(&[("teams.app", "")]),
            &mut by_key,
        );

        assert_eq!(by_key.len(), 1);
        let c = by_key.get("aumid:teams.app").expect("entry");
        assert_eq!(c.display_name.as_deref(), Some("Microsoft Teams"));
        assert!(c.registered);
    }

    #[test]
    fn merge_inserts_windowless_entry_when_no_pid_match() {
        let mut by_key = HashMap::new();

        merge_packaged(
            vec![packaged("Copilot.App", "Copilot", vec![777])],
            &registry(&[("copilot.app", "")]),
            &mut by_key,
        );

        assert_eq!(by_key.len(), 1);
        let c = by_key.get("aumid:copilot.app").expect("entry");
        assert!(!c.has_window);
        assert!(c.registered);
        assert_eq!(c.display_name.as_deref(), Some("Copilot"));
        // `exe_path` resolves via the real `process_image_path` for this pid; not asserted since
        // an arbitrary pid's path is nondeterministic (the merge policy is what matters here).
    }

    #[test]
    fn merge_tags_unregistered_when_absent_from_registry() {
        let mut by_key = HashMap::new();
        merge_packaged(
            vec![packaged("Unknown.App", "Unknown", vec![888])],
            &registry(&[]),
            &mut by_key,
        );

        assert!(!by_key.get("aumid:unknown.app").expect("entry").registered);
    }
}
