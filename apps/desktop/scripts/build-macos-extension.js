/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const child = require("child_process");
const { exit } = require("process");

const fse = require("fs-extra");

const paths = {
  macosBuild: "./macos/build",
  extensionBuild: "./macos/build/Release/autofill-extension.appex",
  extensionDistDir: "./macos/dist",
  extensionDist: "./macos/dist/autofill-extension.appex",
  macOsProject: "./macos/desktop.xcodeproj",
  macOsConfig: "./macos/production.xcconfig",
};

async function buildMacOs() {
  if (fse.existsSync(paths.macosBuild)) {
    fse.removeSync(paths.macosBuild);
  }

  if (fse.existsSync(paths.extensionDistDir)) {
    fse.removeSync(paths.extensionDistDir);
  }

  const proc = child.spawn("xcodebuild", [
    "-project",
    paths.macOsProject,
    "-alltargets",
    "-configuration",
    "Release",
    // Uncomment when signing is fixed
    // "-xcconfig",
    // paths.macOsConfig,
  ]);
  stdOutProc(proc);
  await new Promise((resolve, reject) =>
    proc.on("close", (code) => {
      if (code > 0) {
        console.error("xcodebuild failed with code", code);
        return reject(new Error(`xcodebuild failed with code ${code}`));
      }
      console.log("xcodebuild success");
      resolve();
    }),
  );

  fse.mkdirSync(paths.extensionDistDir);
  fse.copySync(paths.extensionBuild, paths.extensionDist);
  // Delete the build dir, otherwise MacOS will load the extension from there instead of the Bitwarden.app bundle
  fse.removeSync(paths.macosBuild);
}

function stdOutProc(proc) {
  proc.stdout.on("data", (data) => console.log(data.toString()));
  proc.stderr.on("data", (data) => console.error(data.toString()));
}

buildMacOs()
  .then(() => console.log("macOS build complete"))
  .catch((err) => {
    console.error("macOS build failed", err);
    exit(-1);
  });
