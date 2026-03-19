/* eslint-disable no-console */
/** @import { BeforePackContext } from 'app-builder-lib' */
exports.default = run;

/**
 * @param {BeforePackContext} context
 */
async function run(context) {
  console.log("## before pack");
  console.log("Stripping .node files that don't belong to this platform...");
  removeExtraNodeFiles(context);
}

/**
 * Removes Node files for platforms besides the current platform being packaged.
 *
 * @param {BeforePackContext} context
 */
function removeExtraNodeFiles(context) {
  // When doing cross-platform builds, due to electron-builder limitations,
  // .node files for other platforms may be generated and unpacked, so we
  // remove them manually here before signing and distributing.
  const packagerPlatform = context.packager.platform.nodeName;
  const archNames = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64" };
  const packagerArch = archNames[context.arch];
  const platforms = ["darwin", "linux", "win32"];
  const fileFilter = context.packager.info._configuration.files[0].filter;

  // Exclude .node files for non-target platforms
  for (const platform of platforms) {
    if (platform != packagerPlatform) {
      fileFilter.push(`!node_modules/@bitwarden/desktop-napi/desktop_napi.${platform}-*.node`);
      fileFilter.push(`!node_modules/**/prebuilds/${platform}-*/*.node`);
    }
  }

  // Exclude desktop-napi .node files for non-target architectures. Without this,
  // macOS universal builds fail because @electron/universal sees the same arch-specific
  // file in both x64 and arm64 builds.
  const arches = ["x64", "arm64", "ia32", "armv7l"];
  for (const arch of arches) {
    if (arch !== packagerArch) {
      fileFilter.push(
        `!node_modules/@bitwarden/desktop-napi/desktop_napi.${packagerPlatform}-${arch}*.node`,
      );
    }
  }
}
