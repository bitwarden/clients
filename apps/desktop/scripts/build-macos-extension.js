/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const child = require("child_process");
const { exit } = require("process");

const fse = require("fs-extra");
const { build } = require("electron-builder");

const paths = {
  macosBuild: "./macos/build",
  extensionBuildDebug: "./macos/build/Debug/autofill-extension.appex",
  extensionBuildRelease: "./macos/build/Release/autofill-extension.appex",
  extensionDistDir: "./macos/dist",
  extensionDist: "./macos/dist/autofill-extension.appex",
  macOsProject: "./macos/desktop.xcodeproj",
};

exports.default = buildMacOs;

async function buildMacOs() {
  console.log("### Building Autofill Extension");

  if (fse.existsSync(paths.macosBuild)) {
    fse.removeSync(paths.macosBuild);
  }

  if (fse.existsSync(paths.extensionDistDir)) {
    fse.removeSync(paths.extensionDistDir);
  }

  let configuration;
  let buildDirectory;
  const configurationArgument = process.argv[2];
  if (configurationArgument !== undefined) {
    // Use the configuration passed in to determine the configuration file.
    if (configurationArgument == "mas-dev") {
      configuration = "Debug";
      buildDirectory = paths.extensionBuildDebug;
    } else if (configurationArgument == "mas") {
      configuration = "ReleaseAppStore";
      buildDirectory = paths.extensionBuildRelease;
    } else if (configurationArgument == "mac") {
      configuration = "ReleaseDeveloper";
      buildDirectory = paths.extensionBuildRelease;
    } else {
      console.log("### Unable to determine configuration, skipping Autofill Extension build");
      return;
    }
  } else {
    console.log("### No configuration argument found, skipping Autofill Extension build");
    return;
  }

  const proc = child.spawn("xcodebuild", [
    "-project",
    paths.macOsProject,
    "-alltargets",
    "-configuration",
    configuration,
    "CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO",
    "OTHER_CODE_SIGN_FLAGS='--timestamp'",
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
  fse.copySync(buildDirectory, paths.extensionDist);

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
