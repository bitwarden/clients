/* eslint-disable no-console */

/// Build the app source: the Electron main process, the preload script, and the Angular
/// renderer.
///
/// webpack writes all three into one directory, which is what electron-builder packages as the
/// app. That directory is named by the configuration, so this points webpack at it rather than
/// letting it default to apps/desktop/build.
///
/// Usage:
///   node scripts/build-app.mts --build-dir build-mac

import { type BuildConfig } from "./build-config.mts";
import { loadBuildConfig, parseBuildArgs, runCommand, runScript } from "./build-support.mts";

runScript(() => {
  const args = parseBuildArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/build-app.mts --build-dir <dir>");
    return;
  }
  build(loadBuildConfig(args.buildDir));
});

function build(config: BuildConfig): void {
  console.log(`Building the app source (${config.channel}) into ${config.directories.appSource}`);

  const cmd = config.profile === "debug" ? "build:dev" : "build";

  runCommand("npm", ["run", cmd], {
    env: {
      // webpack.base.js resolves this against apps/desktop when it is relative.
      OUTPUT_PATH: config.directories.appSource,
      // Read by apps/desktop/config/config.js, which is what makes a beta build point at beta
      // update channels and use the beta icons. Packaging cannot fix this after the fact, so a
      // beta configuration has to be built as beta.
      ...(config.channel === "beta" ? { CHANNEL: "beta" } : {}),
    },
  });
}
