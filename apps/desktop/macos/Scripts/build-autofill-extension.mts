#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import crypto from "node:crypto";

import { DESKTOP_PROJECT_DIR, runCommand } from "../../scripts/build-support.mts";
import { type BuildConfig, BuildError, type BuildTask } from "../../scripts/build-config.mts";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import BitwardenMacosProviderBuildTask from "../../desktop_native/autofill_provider/build-macos-lib.mts";

const MACOS_PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BitwardenMacosAutofillExtensionBuildTask: BuildTask = {
  targetName: "BitwardenMacosAutofillExtension",
  sourceDir: MACOS_PROJECT_DIR,
  dependencies: [BitwardenMacosProviderBuildTask],

  async validate(config: BuildConfig): Promise<void> {
    const validationErrors: BuildError[] = [];
    if (!config.buildDir) {
      validationErrors.push(new BuildError("Build directory is not set."));
    }

    if (process.platform !== "darwin") {
      validationErrors.push(
        new BuildError(`Cannot build macOS extension on non-macOS host ${process.platform}`),
      );
    }

    if (config.platform !== "macos") {
      validationErrors.push(
        new BuildError(
          `Cannot build macOS autofill extension for non-macOS platform ${config.platform}`,
        ),
      );
    }

    if (!config.macos?.teamId) {
      validationErrors.push(new BuildError(`Apple Team ID not set`));
    }

    if (!config.derived.productName) {
      validationErrors.push(new BuildError(`Product name not set`));
    }

    const appId = config.derived.macos?.autofillExtensionAppId;
    if (!appId) {
      validationErrors.push(new BuildError(`App ID for autofill extension not set`));
    }

    const provisioningProfiles = config.derived.macos?.autofillExtensionProvisioningProfile;
    if (!provisioningProfiles || provisioningProfiles.length === 0) {
      validationErrors.push(new BuildError(`Provisioning profiles for autofill extension not set`));
    }

    if (validationErrors.length > 0) {
      throw new AggregateError(
        validationErrors,
        `Build configuration of ${this.targetName} failed validation`,
      );
    }
  },

  async configure(config, outputDir, privateDir) {
    const bootstrapScript = path.join(DESKTOP_PROJECT_DIR, "macos/Scripts/bootstrap.sh");
    await runCommand(bootstrapScript, [config.buildDir], { cwd: MACOS_PROJECT_DIR });

    const ipcAppGroup = config.derived.macos!.ipcAppGroup;

    // Generate entitlements
    const entitlements = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.app-sandbox</key>
	<true/>
	<key>com.apple.security.application-groups</key>
	<array>
		<string>${ipcAppGroup}</string>
	</array>
	<key>com.apple.developer.authentication-services.autofill-credential-provider</key>
	<true/>
</dict>
</plist>
    `.trim();

    const entitlementsPath = path.join(privateDir, "autofill-extension.entitlements");
    writeFileSync(entitlementsPath, entitlements, { encoding: "utf-8" });
  },

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    await this.validate(config);
    const profile = config.profile;
    const provisioningProfile = config.derived.macos!.autofillExtensionProvisioningProfile;

    const configuration = profile == "release" ? "Release" : "Debug";
    // Packaging for Mac App Store (MAS) vs. a normal Mac application (regardless of
    // package format, .dmg, .pkg, .zip, etc.) requires separate provisioning
    // profiles to be embedded, but the native code it requires doesn't change.
    //
    // To avoid having to rebuild all of the native or TypeScript code, which
    // does not depend on App Store vs Mac, we build this in both step.
    //
    // It would be clearer to treat MAS as a separate platform from macOS, since
    // it changes how code signing must be done.  If there was a smarter build
    // system that could cache on build step inputs rather than the whole build
    // configuration, then rebuilding for MAS after building for macOS we hit
    // build cache for the native code.

    const productDir = path.join(privateDir, `Build/Products/${configuration}`);
    await runCommand(
      "xcodebuild",
      [
        "-project",
        path.join(MACOS_PROJECT_DIR, "BitwardenAutofillExtension.xcodeproj"),
        "-destination",
        "generic/platform=macOS",
        "-configuration",
        configuration,
        "-derivedDataPath",
        privateDir,
        "-scheme",
        "BitwardenAutofillExtension",
        `PROVISIONING_PROFILE_SPECIFIER=${provisioningProfile}`,
      ],
      { logLevel: "debug" },
    );

    const appExtensionPath = path.join(productDir, "BitwardenAutofillExtension.appex");

    const outputPath = path.join(outputDir, path.basename(appExtensionPath));
    if (existsSync(outputPath)) {
      rmSync(outputPath, { recursive: true });
    }
    mkdirSync(path.dirname(outputPath), { recursive: true });
    // Copy rather than move so xcodebuild's product stays in place for incremental builds.
    await runCommand("ditto", [appExtensionPath, outputPath]);
    // Unregister this as a plugin so macOS doesn't try to load this copy instead of the copy from the built macOS app bundle.
    // nvm, this isn't signed yet, so this doesn't matter.
    // runCommand("pluginkit", ["-r", outputPath]);
  },
};

export default BitwardenMacosAutofillExtensionBuildTask;

async function main() {
  const { Command } = await import("commander");

  // Define a program that can take either:
  // - a build directory
  const program = new Command();
  program
    .name("build-macos-autofill-extension")
    .description("CLI to build macOS autofill extension");

  program
    .usage("[<-C|--build-dir> <path>")
    .requiredOption("-C, --build-dir <path>", "Path to the build directory")
    .addHelpText(
      "after",
      `
Examples:
  $ ${program.name()} --build-dir ./build`,
    )
    .action(async (options) => {
      let buildConfig, outputDir, privateDir;
      const buildDir = path.resolve(options.buildDir);
      const buildConfigFile = readFileSync(path.join(buildDir, "build-config.json"), "utf-8");
      buildConfig = JSON.parse(buildConfigFile);
      if (path.resolve(buildConfig.buildDir) != path.resolve(options.buildDir)) {
        program.error("Error: configuration.buildDir and supplied build dir do not match");
      }
      outputDir = path.resolve(
        path.join(buildConfig.buildDir, "apps/desktop/macos/BitwardenAutofillExtension"),
      );
      privateDir = path.resolve(
        path.join(buildConfig.buildDir, "apps/desktop/macos/BitwardenAutofillExtension.p"),
      );

      mkdirSync(outputDir, { recursive: true });
      mkdirSync(privateDir, { recursive: true });
      await BitwardenMacosAutofillExtensionBuildTask.build(buildConfig, outputDir, privateDir);
    });
  program.parse();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
