/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const child = require("child_process");
const { exit } = require("process");

const fse = require("fs-extra");

const paths = {
  macosBuild: "./macos/build",
  extensionBuildDebug: "./macos/build/Debug/autofill-extension.appex",
  extensionBuildReleaseAppStore: "./macos/build/ReleaseAppStore/autofill-extension.appex",
  extensionBuildReleaseDeveloper: "./macos/build/ReleaseDeveloper/autofill-extension.appex",
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
  let codeSignIdentity;
  let provisioningProfileSpecifier;
  let buildDirectory;
  const configurationArgument = process.argv[2];
  if (configurationArgument !== undefined) {
    // Use the configuration passed in to determine the configuration file.
    if (configurationArgument == "mas-dev") {
      configuration = "Debug";
      codeSignIdentity = "Apple Development";
      provisioningProfileSpecifier = "Bitwarden Desktop Autofill Development 2024";
      buildDirectory = paths.extensionBuildDebug;
    } else if (configurationArgument == "mas") {
      configuration = "ReleaseAppStore";
      codeSignIdentity = "3rd Party Mac Developer Application";
      provisioningProfileSpecifier = "Bitwarden Desktop Autofill App Store 2024";
      buildDirectory = paths.extensionBuildReleaseAppStore;
    } else if (configurationArgument == "mac") {
      configuration = "ReleaseDeveloper";
      codeSignIdentity = "Developer ID Application";
      provisioningProfileSpecifier = "Bitwarden Desktop Autofill Extension Developer Dis";
      buildDirectory = paths.extensionBuildReleaseDeveloper;
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

    // While these arguments are defined in the `configuration` file above, xcodebuild has a bug in it currently that requires these arguments
    // be explicitly defined in this call.
    `CODE_SIGN_IDENTITY=${codeSignIdentity}`,
    `PROVISIONING_PROFILE_SPECIFIER=${provisioningProfileSpecifier}`,
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
