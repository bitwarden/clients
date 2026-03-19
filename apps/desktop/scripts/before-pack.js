/* eslint-disable no-console */
/** @import { BeforePackContext } from 'app-builder-lib' */
exports.default = run;

// Snapshot of the original file filter patterns from electron-builder.json.
// During macOS universal builds, beforePack runs once per architecture (x64,
// then arm64), but the config's filter array is a shared mutable reference.
// We capture it on the first run so each invocation can build a clean filter
// from the original base rather than accumulating stale exclusions.
let baseFilterPatterns = null;

/**
 * @param {BeforePackContext} context
 */
async function run(context) {
  console.log("## before pack");
  console.log("Stripping .node files that don't belong to this platform/arch...");
  removeExtraNodeFiles(context);
}

/**
 * Builds exclusion patterns for native .node files that don't match the
 * current target platform and architecture.
 *
 * @param {string} targetPlatform - e.g. "darwin", "win32", "linux"
 * @param {string} targetArch - e.g. "x64", "arm64"
 * @returns {string[]} Glob negation patterns to exclude from the build
 */
function getNativeFileExclusions(targetPlatform, targetArch) {
  const exclusions = [];
  const allPlatforms = ["darwin", "linux", "win32"];
  const allArches = ["x64", "arm64", "ia32", "armv7l"];

  // Exclude .node files built for other platforms
  for (const platform of allPlatforms) {
    if (platform !== targetPlatform) {
      exclusions.push(`!node_modules/@bitwarden/desktop-napi/desktop_napi.${platform}-*.node`);
      exclusions.push(`!node_modules/**/prebuilds/${platform}-*/*.node`);
    }
  }

  // Exclude .node files built for other architectures on the current platform.
  // Without this, macOS universal builds fail because @electron/universal sees
  // the same arch-specific file in both the x64 and arm64 per-arch builds.
  for (const arch of allArches) {
    if (arch !== targetArch) {
      exclusions.push(
        `!node_modules/@bitwarden/desktop-napi/desktop_napi.${targetPlatform}-${arch}*.node`,
      );
    }
  }

  return exclusions;
}

/**
 * Sets the file filter to exclude native .node files for non-target
 * platform/arch combinations.
 *
 * @param {BeforePackContext} context
 */
function removeExtraNodeFiles(context) {
  const targetPlatform = context.packager.platform.nodeName;
  const archNames = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64" };
  const targetArch = archNames[context.arch];

  const filesConfig = context.packager.info._configuration.files[0];

  // Capture the original filter once, before we modify it
  if (baseFilterPatterns === null) {
    baseFilterPatterns = [...filesConfig.filter];
  }

  // Replace the filter with a fresh copy of the base patterns plus exclusions
  // specific to this build's target. This ensures the arm64 run doesn't inherit
  // exclusion patterns pushed during the x64 run (or vice versa).
  const exclusions = getNativeFileExclusions(targetPlatform, targetArch);
  filesConfig.filter = [...baseFilterPatterns, ...exclusions];

  console.log(`  Target: ${targetPlatform}-${targetArch}`);
  console.log(`  Exclusions added: ${exclusions.length} patterns`);
}
