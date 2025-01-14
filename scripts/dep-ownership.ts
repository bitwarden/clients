/* eslint-disable no-console */

/// Ensure that all dependencies in package.json have an owner in the renovate.json file.

import fs from "fs";
import path from "path";

const renovateConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", ".github", "renovate.json"), "utf8"),
);

const packagesWithOwners = renovateConfig.packageRules
  .flatMap((rule: any) => rule.matchPackageNames)
  .filter((packageName: string) => packageName != null);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
);
const dependencies = Object.keys(packageJson.dependencies).concat(
  Object.keys(packageJson.devDependencies),
);

const missingOwners = dependencies.filter((dep) => !packagesWithOwners.includes(dep));

if (missingOwners.length > 0) {
  console.error("Missing owners for the following dependencies:");
  console.error(missingOwners.join("\n"));
  process.exit(1);
}

console.log("All dependencies have owners.");
