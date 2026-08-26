/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Stamp the beta version into the built package.json.
 *
 * electron-builder resolves the app version from the build directory
 * (`directories.app`), which webpack populates by copying src/package.json. Writing
 * the beta version here leaves the committed source untouched.
 *
 * BETA_PACKAGE_VERSION is computed once in build-desktop.yml, which also uses it for
 * artifact paths, so it is passed in rather than derived again here.
 */
const fs = require("fs");
const path = require("path");

const packagePath = path.resolve(__dirname, "../build/package.json");
const betaVersion = process.env.BETA_PACKAGE_VERSION ?? "";

if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(betaVersion)) {
  console.error(`ERROR: BETA_PACKAGE_VERSION must look like 1.2.3-beta.4, got '${betaVersion}'`);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  console.error(`ERROR: ${packagePath} not found, run the build first`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

// Also guards against stamping an already-stamped package.json, whose version would
// no longer be the plain base version.
if (!betaVersion.startsWith(`${pkg.version}-beta.`)) {
  console.error(
    `ERROR: BETA_PACKAGE_VERSION '${betaVersion}' does not extend the built version '${pkg.version}'`,
  );
  process.exit(1);
}

pkg.version = betaVersion;
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Updated version to ${pkg.version} in ${packagePath}`);
