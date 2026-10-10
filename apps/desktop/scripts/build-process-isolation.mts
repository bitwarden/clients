/// Build the process isolation library.
///
/// A cdylib the Linux launcher preloads into the app (see resources/linux-wrapper.sh, which
/// sets it as LD_PRELOAD under Flatpak) so it can harden the process before anything else
/// runs. Linux only; the crate's dependencies are all behind cfg(target_os = "linux").
///
/// It is staged with its architecture in the name, because one staging directory holds every
/// architecture the configuration asked for. The packaging step renames it back to the plain
/// libprocess_isolation.so the launcher looks for.
///
/// Usage:
///   node scripts/build-process-isolation.mts --build-dir build-lin

import { buildCargoArtifact } from "./cargo-build.mts";

buildCargoArtifact({
  cargoPackage: "process_isolation",
  targetKey: "processIsolation",
  kind: "library",
});
