/* eslint-disable no-console */

/// Ensure that all dependencies in package.json and Cargo.toml have an owner in the renovate.json5 file.

import fs from "fs";
import path from "path";

import JSON5 from "json5";

const renovateConfig = JSON5.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", ".github", "renovate.json5"), "utf8"),
);

// Extract all packages with owners from renovate config
const packagesWithOwners = renovateConfig.packageRules
  .flatMap((rule: any) => rule.matchPackageNames)
  .filter((packageName: string) => packageName != null);

function hasOwner(packageName: string): boolean {
  return packagesWithOwners.includes(packageName);
}

// Collect npm dependencies
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
);
const npmDependencies = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {}),
];

// Collect Cargo dependencies from workspace Cargo.toml
const cargoTomlPath = path.join(
  __dirname,
  "..",
  "..",
  "apps",
  "desktop",
  "desktop_native",
  "Cargo.toml",
);
const cargoTomlContent = fs.existsSync(cargoTomlPath) ? fs.readFileSync(cargoTomlPath, "utf8") : "";

const cargoDependencies = new Set<string>();

// Extract dependency names from [workspace.dependencies] section by
// extracting everything between [workspace.dependencies] and the next section start
// (indicated by a "\n[").
const workspaceSection =
  cargoTomlContent.split("[workspace.dependencies]")[1]?.split(/\n\[/)[0] ?? "";

// Process each line to extract dependency names
workspaceSection
  .split("\n") // Process each line
  .map((line) => line.match(/^([a-zA-Z0-9_-]+)\s*=/)?.[1]) // Find the dependency name
  .filter((depName): depName is string => depName != null && !depName.startsWith("bitwarden")) // Make sure it's not an empty line or a Bitwarden dependency
  .forEach((depName) => cargoDependencies.add(depName));

// Check for missing owners
const missingNpmOwners = npmDependencies.filter((dep) => !hasOwner(dep));
const missingCargoOwners = Array.from(cargoDependencies).filter((dep) => !hasOwner(dep));

const allMissing = [...missingNpmOwners, ...missingCargoOwners];

if (allMissing.length > 0) {
  console.error("Missing owners for the following dependencies:");
  if (missingNpmOwners.length > 0) {
    console.error("\nNPM dependencies:");
    console.error(missingNpmOwners.join("\n"));
  }
  if (missingCargoOwners.length > 0) {
    console.error("\nCargo dependencies:");
    console.error(missingCargoOwners.join("\n"));
  }
  process.exit(1);
}

console.log("All dependencies have owners.");
