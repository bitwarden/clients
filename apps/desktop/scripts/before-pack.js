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
  // When doing cross-platform builds, due to electron-builder limitiations,
  // .node files for other platforms may be generated and unpacked, so we
  // remove them manually here before signing and distributing.
  const packagerPlatform = context.packager.platform.nodeName;
  const platforms = ["darwin", "linux", "win32"];
  const fileFilter = context.packager.info._configuration.files[0].filter;
  for (const platform of platforms) {
    if (platform != packagerPlatform) {
      fileFilter.push(`!node_modules/@bitwarden/desktop-napi/desktop_napi.${platform}-*.node`);
      fileFilter.push(`!node_modules/**/prebuilds/${platform}-*/*.node`);
    }
  }

  // For macOS universal builds, before-pack runs separately for x64 and arm64.
  // Strip the other darwin arch's prebuilds so @electron/universal doesn't detect
  // identical cross-arch native binaries when merging the two builds.
  if (packagerPlatform === "darwin") {
    const { Arch } = require("app-builder-lib");
    const otherDarwinArch = context.arch === Arch.arm64 ? "x64" : "arm64";
    fileFilter.push(`!node_modules/**/prebuilds/darwin-${otherDarwinArch}/*.node`);
  }
}
