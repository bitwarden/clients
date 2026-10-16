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

/// What changes about the extension per release channel. macOS requires an extension's bundle
/// identifier to be prefixed by its containing app's, and a provisioning profile authorizes one
/// App ID, so each channel signs with its own profiles. The Xcode project derives the bundle
/// identifier, App Group and display name from `appId` and `productName`.
///
/// Stable signs with the entitlements the Xcode project names for each configuration; beta passes
/// its own copies, which differ only in naming beta's App Group.
const channels = {
  stable: {
    appId: "com.bitwarden.desktop",
    productName: "Bitwarden",
    provisioningProfiles: {
      "mas-dev": "PM Stable Desktop-ExtAutofill Testing",
      mas: "PM Stable Desktop-ExtAutofill AppStore",
      mac: "PM Stable Desktop-ExtAutofill Distrib",
    },
  },
  beta: {
    appId: "com.bitwarden.beta.desktop",
    productName: "Bitwarden Beta",
    provisioningProfiles: {
      "mas-dev": "PM Beta Desktop-ExtAutofill Testing",
      mas: "PM Beta Desktop-ExtAutofill AppStore",
      mac: "PM Beta Desktop-ExtAutofill Distrib",
    },
    // Relative to the Xcode project, as the project's own CODE_SIGN_ENTITLEMENTS are.
    entitlements: {
      "mas-dev": "autofill-extension/autofill_extension_enabled.beta.entitlements",
      mas: "autofill-extension/autofill_extension.beta.entitlements",
      mac: "autofill-extension/autofill_extension_enabled.beta.entitlements",
    },
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

  const channelArgument = process.argv[3] ?? "stable";
  const channel = channels[channelArgument];
  if (channel === undefined) {
    console.log(`### Unknown channel '${channelArgument}', skipping Autofill Extension build`);
    return;
  }
  console.log(`### Channel '${channelArgument}', hosted by ${channel.appId}`);

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
    `PROVISIONING_PROFILE_SPECIFIER=${channel.provisioningProfiles[configurationArgument]}`,

    // A setting given on the command line outranks the target's own build settings, which is
    // what retargets the whole extension at the channel's app.
    `BITWARDEN_APP_ID=${channel.appId}`,
    `BITWARDEN_PRODUCT_NAME=${channel.productName}`,
    ...(channel.entitlements
      ? [`CODE_SIGN_ENTITLEMENTS=${channel.entitlements[configurationArgument]}`]
      : []),
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
