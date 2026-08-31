/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const child = require("child_process");
const path = require("path");
const { exit } = require("process");

const fse = require("fs-extra");

const paths = {
  macosBuild: "./macos/build",
  extensionBuildDebug: "./macos/build/Debug",
  extensionBuildReleaseAppStore: "./macos/build/ReleaseAppStore",
  extensionBuildReleaseDeveloper: "./macos/build/ReleaseDeveloper",
  extensionDistDir: "./macos/dist",
  macOsProject: "./macos/desktop.xcodeproj",
};

// Each release channel has its own Xcode target so that the extension is built with the
// bundle identifier, App Group and provisioning profile of the app that hosts it. Building
// `-alltargets` would produce every channel's extension on every build, so the target is
// selected explicitly.
const channels = {
  stable: {
    target: "autofill-extension",
    profiles: {
      "mas-dev": "Bitwarden Desktop Autofill Development 2024",
      mas: "Bitwarden Desktop Autofill App Store 2024",
      mac: "Bitwarden Desktop Autofill Extension Developer Dis",
    },
  },
  beta: {
    target: "autofill-extension.beta",
    profiles: {
      "mas-dev": "Beta Bitwarden Desktop Autofill Development",
      mas: "Beta Bitwarden Desktop Autofill App Store",
      mac: "Beta Bitwarden Desktop Autofill Developer ID",
    },
  },
};

const configurations = {
  "mas-dev": {
    configuration: "Debug",
    codeSignIdentity: "Apple Development",
    buildDirectory: paths.extensionBuildDebug,
  },
  mas: {
    configuration: "ReleaseAppStore",
    codeSignIdentity: "3rd Party Mac Developer Application",
    buildDirectory: paths.extensionBuildReleaseAppStore,
  },
  mac: {
    configuration: "ReleaseDeveloper",
    codeSignIdentity: "Developer ID Application",
    buildDirectory: paths.extensionBuildReleaseDeveloper,
  },
};

exports.default = buildMacOs;

async function buildMacOs() {
  console.log("### Building Autofill Extension");

  const configurationArgument = process.argv[2];
  const channelArgument = process.argv[3] ?? "stable";

  if (fse.existsSync(paths.macosBuild)) {
    fse.removeSync(paths.macosBuild);
  }

  if (fse.existsSync(paths.extensionDistDir)) {
    fse.removeSync(paths.extensionDistDir);
  }

  if (configurationArgument === undefined) {
    console.log("### No configuration argument found, skipping Autofill Extension build");
    return;
  }

  const selected = configurations[configurationArgument];
  if (selected === undefined) {
    console.log("### Unable to determine configuration, skipping Autofill Extension build");
    return;
  }
  const { configuration, codeSignIdentity, buildDirectory } = selected;

  const channel = channels[channelArgument];
  if (channel === undefined) {
    console.log(`### Unknown channel '${channelArgument}', skipping Autofill Extension build`);
    return;
  }
  const provisioningProfileSpecifier = channel.profiles[configurationArgument];

  const proc = child.spawn("xcodebuild", [
    "-project",
    paths.macOsProject,
    "-target",
    channel.target,
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
  fse.copySync(
    path.join(buildDirectory, `${channel.target}.appex`),
    path.join(paths.extensionDistDir, `${channel.target}.appex`),
  );

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
