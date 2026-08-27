/// Build the Chromium import helper.
///
/// Reads passwords out of a locally installed Chromium browser so they can be imported.
/// Windows only, because that is where the browser's own encryption needs a separate process
/// to unwrap. CI checks the shipped binary's signature thumbprint against a hardcoded value,
/// so it must be the one built here rather than one picked up from somewhere else.
///
/// Usage:
///   node scripts/build-chromium-import-helper.mts --build-dir build-win

import { buildCargoBinary } from "./cargo-build.mts";

buildCargoBinary({ bin: "bitwarden_chromium_import_helper", targetKey: "chromiumImportHelper" });
