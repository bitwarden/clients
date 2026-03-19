/* eslint-disable no-console */

/// Ensure that `sdk-internal` and `commercial-sdk-internal` dependencies have matching versions.

import fs from "fs";
import path from "path";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
);

const sdkInternal = packageJson.dependencies["@bitwarden/sdk-internal"];
const commercialSdkInternal = packageJson.dependencies["@bitwarden/commercial-sdk-internal"];

if (sdkInternal !== commercialSdkInternal) {
  console.error(
    `Version mismatch between @bitwarden/sdk-internal (${sdkInternal}) and @bitwarden/commercial-sdk-internal (${commercialSdkInternal}), must be an exact match.`,
  );
  process.exit(1);
}

console.log(`All dependencies have matching versions: ${sdkInternal}`);
