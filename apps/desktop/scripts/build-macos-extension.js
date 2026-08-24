/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const child = require("child_process");
const path = require("path");
const { exit } = require("process");

const fse = require("fs-extra");

const { APP_IDS, PRODUCT_NAMES } = require("./channel.js");

const paths = {
  macosBuild: "./macos/build",
  extensionBuildDebug: "./macos/build/Debug/autofill-extension.appex",
  extensionBuildReleaseAppStore: "./macos/build/ReleaseAppStore/autofill-extension.appex",
  extensionBuildReleaseDeveloper: "./macos/build/ReleaseDeveloper/autofill-extension.appex",
  extensionDistDir: "./macos/dist",
  extensionDist: "./macos/dist/autofill-extension.appex",
  macOsProject: "./macos/desktop.xcodeproj",
  generatedEntitlements: "./intermediates/entitlements/autofill-extension.plist",
};

/// The extension's provisioning profile, per release channel and per distribution. A profile
/// authorizes one App ID, and the extension's App ID follows the app's, so beta cannot be signed
/// with stable's profile even though the entitlements would otherwise look the same.
const provisioningProfiles = {
  stable: {
    "mas-dev": "Bitwarden Desktop Autofill Development 2024",
    mas: "Bitwarden Desktop Autofill App Store 2024",
    mac: "Bitwarden Desktop Autofill Extension Developer Dis",
  },
  beta: {
    "mas-dev": "Beta Bitwarden Desktop Autofill Development",
    mas: "Beta Bitwarden Desktop Autofill App Store",
    mac: "Beta Bitwarden Desktop Autofill Developer ID",
  },
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
  let buildDirectory;
  const configurationArgument = process.argv[2];
  if (configurationArgument !== undefined) {
    // Use the configuration passed in to determine the configuration file.
    if (configurationArgument == "mas-dev") {
      configuration = "Debug";
      codeSignIdentity = "Apple Development";
      buildDirectory = paths.extensionBuildDebug;
    } else if (configurationArgument == "mas") {
      configuration = "ReleaseAppStore";
      codeSignIdentity = "3rd Party Mac Developer Application";
      buildDirectory = paths.extensionBuildReleaseAppStore;
    } else if (configurationArgument == "mac") {
      configuration = "ReleaseDeveloper";
      codeSignIdentity = "Developer ID Application";
      buildDirectory = paths.extensionBuildReleaseDeveloper;
    } else {
      console.log("### Unable to determine configuration, skipping Autofill Extension build");
      return;
    }
  } else {
    console.log("### No configuration argument found, skipping Autofill Extension build");
    return;
  }

  // Which app hosts this extension. macOS requires an extension's bundle identifier to be
  // prefixed by its containing app's, so the channel decides the extension's identity too.
  const channelArgument = process.argv[3] ?? "stable";
  const appId = APP_IDS[channelArgument];
  if (appId === undefined) {
    console.log(`### Unknown channel '${channelArgument}', skipping Autofill Extension build`);
    return;
  }
  const provisioningProfileSpecifier = provisioningProfiles[channelArgument][configurationArgument];

  console.log(`### Channel '${channelArgument}', hosted by ${appId}`);

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

    // A setting given on the command line outranks the target's own build settings and the
    // .xcconfig behind them, which is the only reason the two above take effect at all. The
    // project derives PRODUCT_BUNDLE_IDENTIFIER, BITWARDEN_APP_GROUP and the extension's display
    // name from these, so passing the app's identity is enough to retarget the whole build.
    `BITWARDEN_APP_ID=${appId}`,
    `BITWARDEN_PRODUCT_NAME=${PRODUCT_NAMES[channelArgument]}`,

    // Beta signs with entitlements generated from its own identifier; stable still signs with the
    // checked-in ones the project already names, so it is left alone. Absolute because xcodebuild
    // resolves this against the Xcode project's directory rather than apps/desktop.
    ...(channelArgument === "stable"
      ? []
      : [`CODE_SIGN_ENTITLEMENTS=${path.resolve(paths.generatedEntitlements)}`]),
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
