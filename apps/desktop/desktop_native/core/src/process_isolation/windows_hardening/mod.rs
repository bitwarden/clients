//! Hardening of the main process and its child processes against memory access.
//!
//! By default every process running as the same user may open any other process of that
//! user with full access, read its memory (`ReadProcessMemory`, `MiniDumpWriteDump`) or
//! inject a thread. Malware running as the user could dump Bitwarden's memory without
//! elevation. `dacl` restricts who may open each process; `process_watcher` reports the
//! children Chromium starts, so each one is hardened too.
//!
//! ```text
//! isolate
//!  └─ process_watcher::watch ── stream: Added(main), then Added / Removed for each child
//!       └─ dacl::Hardener::run, on its own thread
//!            ├─ Added:   check identity (process), then replace the DACL and add the ACE
//!            └─ Removed: forget the child
//! ```

mod dacl;
mod process;
mod process_watcher;

use std::{sync::Once, thread};

use anyhow::Result;

/// Ensures only one watcher and hardening thread run, even if `isolate_process` is called
/// twice.
static STARTED: Once = Once::new();

/// Starts watching the main process and its child processes, and hardens each one
/// (main, renderer, GPU, network/utility, crashpad) on a background thread, since Chromium
/// spawns them lazily and respawns them after crashes, and the app may open further
/// renderer processes for dialogs separate from the main renderer. Hardening failures,
/// including main's, are logged by that thread.
pub(super) fn isolate() -> Result<()> {
    let hardener = dacl::Hardener::new()?;

    STARTED.call_once(move || {
        let events = process_watcher::watch();
        thread::spawn(move || hardener.run(events));
    });

    Ok(())
}
