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
    }
  }
}
