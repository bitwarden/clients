#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import BitwardenMacosProviderBuildTask from "../desktop_native/autofill_provider/build-macos-lib.mts";
import DesktopProxyBuildTask from "../desktop_native/proxy/build-desktop-proxy.mts";
import NapiBuildTask from "../desktop_native/napi/scripts/build-napi.mts";
import BitwardenMacosAutofillExtensionBuildTask from "../macos/Scripts/build-autofill-extension.mts";
import WebpackBuildTask from "../build-app.mts";

import {
  type BuildConfig,
  type Channel,
  PACKAGE_FORMATS,
  type Platform,
  BuildError,
  type BuildTask,
  getBuildDirectories,
  AUDIENCES,
  type PackageFormat,
} from "./build-config.mts";
import {
  BITWARDEN_APPLE_TEAM_ID,
  discoverDeveloperCodeSigningCertificates,
  discoverProvisioningProfilesByName,
  getARCHSForArchitecture,
  getXcodeLibraryIdentifierForArchitecture,
  XCODE_PROVISIONING_PROFILES,
} from "./build-support-macos.mts";
import { CARGO_WORKSPACE_DIR } from "./build-support-rust.mts";

async function configureBuildTask(config: BuildConfig, task: BuildTask): Promise<void> {
  const { outputDir, privateDir } = getBuildDirectories(config, task);
  await task.validate(config);
  await task.configure(config, outputDir, privateDir);
}

function getDependencyOrder(tasks: BuildTask[]): BuildTask[] {
  const ordered: BuildTask[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (task: BuildTask) => {
    if (visited.has(task.targetName)) {
      return;
    }
    if (visiting.has(task.targetName)) {
      throw new BuildError(`Dependency cycle detected at task ${task.targetName}`);
    }
    visiting.add(task.targetName);
    for (const dependency of task.dependencies) {
      visit(dependency);
    }
    visiting.delete(task.targetName);
    visited.add(task.targetName);
    ordered.push(task);
  };

  for (const target of tasks) {
    visit(target);
  }
  return ordered;
}

async function main() {
  const { Command, Option } = await import("commander");

  const program = new Command();
  program.name("build-config").description("CLI to create build configuration for desktop project");

  const platformMap = {
    linux: "linux",
    darwin: "macos",
    win32: "windows",
  };

  const collectValues = (value: string, arr: string[]) => (arr ?? []).concat([value]);

  program
    .addOption(
      new Option(
        "-C, --build-dir <path>",
        "Path to the build directory to create",
      ).makeOptionMandatory(true),
    )
    .addOption(
      new Option("--profile <profile>", "Build profile to use")
        .choices(["debug", "release"])
        .default("debug"),
    )
    .addOption(
      new Option("--channel <channel>", "Release channel to use")
        .choices(["stable", "beta"])
        .default("stable"),
    )
    .addOption(
      new Option("--platform <platform>", "Platform to build for")
        .choices(["linux", "macos", "windows"])
        .default(platformMap[process.platform as keyof typeof platformMap], "Platform of the host"),
    )
    .addOption(
      new Option("--architecture <arch>", "Architecture to build for")
        .choices(["x64", "arm64", "ia32", "universal"])
        .default(process.arch, "Architecture of the host"),
    )
    .addOption(
      new Option("--package-format <format>", "Packaging format to build. May be one or more times")
        .makeOptionMandatory(true)
        .choices(Object.keys(PACKAGE_FORMATS))
        .argParser(collectValues),
    )
    .addOption(
      new Option("--audience <format>", "Audience to build for.")
        .choices(AUDIENCES)
        .default("internal"),
    )
    .addOption(
      new Option("--package-signing <signing>", "Whether to sign the package")
        .choices(["unsigned", "signed", "notarized"])
        .default("unsigned"),
    )
    .addOption(
      new Option(
        "--signing-certificate <specifier>",
        "Certificate specifier. On macOS, this is the SHA-1 hash of the signing certificate.",
      ),
    )
    .addOption(
      new Option(
        "--with-autofill-extension",
        "Whether to include the autofill extension/plugin for this platform",
      ).default(false),
    );

  program.action(async (options) => {
    const config: BuildConfig = {
      toolchains: {},
      derived: {},
      features: {},
    } as BuildConfig;
    let isValid = true;
    const tasks = [];

    console.log("Project: @bitwarden/desktop");
    console.log("Source directory:", path.resolve(fileURLToPath(import.meta.url), ".."));

    config.buildDir = path.resolve(options.buildDir);
    console.log("Build directory:", config.buildDir);

    config.channel = options.channel;
    console.log("Release channel:", config.channel);

    config.profile = options.profile;
    console.log("Build profile:", config.profile);

    config.architecture = options.architecture;
    console.log("CPU architecture:", config.architecture);

    config.platform = options.platform;
    console.log("Platform:", config.platform);

    config.derived.hostPlatform = platformMap[
      process.platform as keyof typeof platformMap
    ] as Platform;
    console.log("Host Platform:", config.derived.hostPlatform);

    config.derived.isCrossPlatform = config.platform !== config.derived.hostPlatform;

    config.derived.cargoTargetDir = path.join(CARGO_WORKSPACE_DIR, "target");
    console.log("Is Cross Platform:", config.derived.isCrossPlatform);

    if (config.platform === "linux") {
      config.linux = {} as any;
    }
    if (config.platform === "macos") {
      config.macos = {
        teamId: BITWARDEN_APPLE_TEAM_ID,
      };
      config.derived.macos = {} as any;

      const libraryIdentifier = getXcodeLibraryIdentifierForArchitecture(options.architecture);
      config.derived.macos!.libraryIdentifier = libraryIdentifier;
      config.derived.macos!.ARCHS = getARCHSForArchitecture(config.architecture);
    }
    if (config.platform === "windows") {
      config.windows = {} as any;
    }

    let cargoBin: string, cargoVersion: string;
    try {
      cargoBin = execFileSync(process.platform == "win32" ? "where" : "which", ["cargo"])
        .toString()
        .trim();
      const output = execFileSync(cargoBin, ["--version"], {
        encoding: "utf-8",
      });
      cargoVersion = output.split(" ")[1];
      config.toolchains.cargo = { bin: cargoBin, version: cargoVersion };
      console.log("Cargo version:", cargoVersion);
    } catch (error) {
      console.error("❌ Could not find Cargo binary", error);
      isValid = false;
    }

    let nodeBin, nodeVersion: string;
    try {
      nodeBin = execFileSync(process.platform == "win32" ? "where" : "which", ["node"])
        .toString()
        .trim();
      nodeVersion = execFileSync(nodeBin, ["--version"], {
        encoding: "utf-8",
      }).trim();
      config.toolchains.node = { bin: nodeBin, version: nodeVersion };
      console.log("Node version:", nodeVersion);
    } catch (error) {
      console.error("❌ Could not find Node binary", error);
      isValid = false;
    }

    config.audience = options.audience;
    console.log("Audience:", config.audience);

    for (const packageFormat of options.packageFormat) {
      if (packageFormat != "dir" && PACKAGE_FORMATS[packageFormat] != options.platform) {
        isValid = false;
        console.error(
          `❌ Invalid package format ${packageFormat} specified for platform: ${options.platform}`,
        );
      }
    }
    const packageFormats = new Set(config.packageFormats);
    let isMasBuild = false;
    let isMacBuild = false;
    // This prevents us from having to set multiple provisioning profiles, which would require us to compiling app package twice.
    if (config.platform === "macos") {
      const masFormats: Set<PackageFormat> = new Set(["mac-app-store"]);
      isMasBuild = !packageFormats.isDisjointFrom(masFormats);
      const macFormats: Set<PackageFormat> = new Set(["dmg", "mac-zip"]);
      isMacBuild = !packageFormats.isDisjointFrom(macFormats);
      if (isMasBuild && isMacBuild) {
        console.error("❌ Only Mac App Store or direct download package formats are allowed");
        isValid = false;
      }
    }
    config.packageFormats = options.packageFormat;
    console.log("Package formats:", config.packageFormats.join(", "));

    // macOS provisioning profiles
    let appProvisioningProfile: string;
    if (config.platform === "macos") {
      const withAutofill = options.withAutofillExtension;
      if (withAutofill) {
        switch (config.channel) {
          case "stable":
            switch (config.audience) {
              case "public":
                if (isMasBuild) {
                  // TODO(BRE-2234): Update with new provisioning profile names.
                  // appProvisioningProfile = "PM Stable Desktop AppStore";
                  appProvisioningProfile = "Bitwarden Desktop App Store 2024 w autofill";
                } else {
                  // TODO(BRE-2234): Update with new provisioning profile names.
                  // appProvisioningProfile =  "PM Stable Desktop Distrib";
                  throw new BuildError(
                    "Building a developer distribution with autofill extension enabled is not currently supported",
                  );
                }
                break;
              case "internal":
                // TODO(BRE-2234): Update with new provisioning profile names.
                // appProvisioningProfile =  "PM Stable Desktop Testing";
                appProvisioningProfile = "Bitwarden Desktop Development (2021)";
                break;
            }
            break;
          case "beta":
            switch (config.audience) {
              case "public":
                if (isMasBuild) {
                  // TODO(BRE-2234): Update with new provisioning profile names.
                  // appProvisioningProfile = "PM Beta Desktop AppStore";
                  throw new BuildError("Beta build not supported for App Store");
                } else {
                  // TODO(BRE-2234): Update with new provisioning profile names.
                  // appProvisioningProfile =  "PM Beta Desktop Distrib";
                  throw new BuildError("Beta build not supported for Developer Distribution");
                }
                break;
              case "internal":
                // TODO(BRE-2234): Update with new provisioning profile names.
                // appProvisioningProfile =  "PM Stable Desktop Testing";
                appProvisioningProfile = "Beta Bitwarden Desktop Development";
                break;
            }
            break;
        }
      } else {
        // TODO(BRE-2234): This entire else block can be delete once BRE-2234 is
        // completed, as all the provisioning profiles will have the autofill
        // entitlement available for use.
        switch (config.channel) {
          case "stable":
            switch (config.audience) {
              case "public":
                if (isMasBuild) {
                  appProvisioningProfile = "Bitwarden Desktop App Store 2021";
                } else {
                  appProvisioningProfile = "Bitwarden Desktop Autofill Extension Developer Dis";
                }
                break;
              case "internal":
                appProvisioningProfile = "Bitwarden Desktop Development (2021)";
                break;
            }
            break;
          case "beta":
            switch (config.audience) {
              case "public":
                if (isMasBuild) {
                  throw new BuildError("Beta build not supported for App Store");
                } else {
                  throw new BuildError("Beta build not supported for Developer Distribution");
                }
              case "internal":
                appProvisioningProfile = "Beta Bitwarden Desktop Development";
                break;
            }
            break;
        }
      }
      config.derived.macos!.appProvisioningProfile = appProvisioningProfile;
      console.log("App Provisioning Profile:", appProvisioningProfile);
    }

    const packageSigningEnabled = ["signed", "notarized"].includes(options.packageSigning);
    config.signed = packageSigningEnabled;
    console.log("Package signing:", packageSigningEnabled);
    // Populate signing certificate details at config time for developer flow only.
    // CI may not want signing secrets available to config/build jobs, so we
    // allow it to be unspecified.
    if (packageSigningEnabled && options.platform === "macos" && options.audience === "internal") {
      if (options.signingCertificate) {
        // Check if there are any provisioning profiles that match this certificate
        const provisioningProfiles = await discoverProvisioningProfilesByName(
          config.derived.macos!.appProvisioningProfile,
          [XCODE_PROVISIONING_PROFILES],
        );
        const hasEligibleCert = provisioningProfiles.some((p) =>
          p.developerCertificates.includes(options.signingCertificate),
        );
        if (!hasEligibleCert) {
          console.error(
            "❌ No developer signing certificate found for required provisioning profile. Double-check that you've specified the correct certificate, and then ask BRE team to add your signing certificate to the provisioning profile",
          );
          console.error("  Provisioning profile:", config.derived.macos!.appProvisioningProfile);
          console.error("  Code signing certificate:", options.signingCertificate);
          isValid = false;
        } else {
          config.macos!.signingCertificate = options.signingCertificate;
          console.log("Signing certificate:", options.signingCertificate);
        }
      } else {
        const availableCerts = await discoverDeveloperCodeSigningCertificates();
        if (availableCerts.length === 1) {
          const certHash = availableCerts[0];
          const provisioningProfiles = await discoverProvisioningProfilesByName(
            config.derived.macos!.appProvisioningProfile,
            [XCODE_PROVISIONING_PROFILES],
          );
          const hasEligibleCert = provisioningProfiles.some((p) =>
            p.developerCertificates.includes(certHash),
          );
          if (hasEligibleCert) {
            config.macos!.signingCertificate = certHash;
            console.log("Signing certificate:", certHash);
          }
        } else if (availableCerts.length === 0) {
          console.error(
            "❌ No code signing certificates found. Register one with your Apple account, then ask BRE to add the certificate to the ${appProvisioningProfile} provisioning profile.",
          );
          isValid = false;
        } else {
          console.error("❌ Multiple signing certificates found, please specify", availableCerts);
          isValid = false;
        }
      }
    }

    const notarizationEnabled = options.packageSigning === "notarized";
    if (options.platform === "macos") {
      config.macos!.notarize = notarizationEnabled;
      console.log("Notarization:", notarizationEnabled);
    } else {
      if (notarizationEnabled) {
        console.error("❌ Notarization requested, but it is only available on macOS");
        isValid = false;
      }
    }

    const appId = {
      macos: {
        stable: "com.bitwarden.desktop",
        beta: "com.bitwarden.beta.desktop",
      },
      linux: {
        stable: "com.bitwarden.desktop",
        beta: "com.bitwarden.beta.desktop",
      },
      windows: {
        stable: "com.bitwarden.desktop",
        beta: "com.bitwarden.beta.desktop",
      },
    }[options.platform as Platform][options.channel as Channel];
    if (!appId) {
      throw new Error(
        `Could not derive app ID for platform ${options.platform} for channel ${options.channel}`,
      );
    }
    config.derived.appId = appId;
    console.log("App ID:", appId);

    const ipcAppGroup = `${BITWARDEN_APPLE_TEAM_ID}.${appId}`;
    config.derived.macos!.ipcAppGroup = ipcAppGroup;
    console.log("IPC App Group:", ipcAppGroup);

    // Product name
    const productName = {
      stable: "Bitwarden",
      beta: "Bitwarden Beta",
    }[options.channel as Channel];
    config.derived.productName = productName;
    console.log("Product name:", productName);

    // Required features
    tasks.push(DesktopProxyBuildTask);
    tasks.push(NapiBuildTask);
    tasks.push(WebpackBuildTask);

    // Optional features

    if (options.withAutofillExtension) {
      if (options.platform === "macos") {
        tasks.push(BitwardenMacosProviderBuildTask);
        tasks.push(BitwardenMacosAutofillExtensionBuildTask);
        let autofillExtensionAppId;
        let extensionProvisioningProfile: string;
        switch (config.channel) {
          case "stable":
            autofillExtensionAppId = "com.bitwarden.desktop.autofill-extension";

            switch (config.audience) {
              case "public":
                if (isMasBuild) {
                  // TODO(BRE-2234): Update with new provisioning profile names.
                  // extensionProvisioningProfile = "PM Stable Desktop-ExtAutofill AppStore";
                  extensionProvisioningProfile = "Bitwarden Desktop Autofill App Store 2024";
                } else {
                  // TODO(BRE-2234): Update with new provisioning profile names.
                  // extensionProvisioningProfile = "PM Stable Desktop-ExtAutofill Distrib";
                  extensionProvisioningProfile =
                    "Bitwarden Desktop Autofill Extension Developer Dis";
                }
                break;
              case "internal":
                // TODO(BRE-2234): Update with new provisioning profile names.
                if (isMasBuild) {
                  // extensionProvisioningProfile = "PM Stable Desktop-ExtAutofill Testing";
                  extensionProvisioningProfile = "Bitwarden Desktop Autofill Development 2024";
                } else {
                  // extensionProvisioningProfile = "PM Stable Desktop-ExtAutofill Testing"
                  extensionProvisioningProfile = "Bitwarden Desktop Autofill Development 2024";
                }
                break;
              default:
                throw new BuildError(`Unknown audience: ${config.audience}`);
            }
            break;
          case "beta":
            autofillExtensionAppId = "com.bitwarden.beta.desktop.autofill-extension";

            switch (config.audience) {
              case "public":
                // TODO(BRE-2234): Update with new provisioning profile names.
                throw new BuildError("Public beta autofill extension is not supported");
                if (isMasBuild) {
                  extensionProvisioningProfile = "PM Beta Desktop-ExtAutofill AppStore";
                } else {
                  extensionProvisioningProfile = "PM Beta Desktop-ExtAutofill Distrib";
                }
                break;
              case "internal":
                extensionProvisioningProfile = "Beta Bitwarden Desktop Autofill Development";
                break;
              default:
                throw new BuildError(`Unknown audience: ${config.audience}`);
            }
        }
        if (options.packageSigning === "signed" && ["internal"].includes(config.audience)) {
          // When producing a signed developer build, check that the developer
          // has an appropriate signing certificate for the required
          // provisioning profiles.
          const profiles = await discoverProvisioningProfilesByName(extensionProvisioningProfile, [
            // DESKTOP_PROJECT_DIR,
            // CLIENTS_PROJECT_DIR,
            XCODE_PROVISIONING_PROFILES,
          ]);
          if (profiles.length === 0) {
            console.error(
              `❌ No provisioning profile files found in Xcode directory. Ensure that the certificates are installed into ${XCODE_PROVISIONING_PROFILES} using Xcode or manually copying into the directory.`,
            );
            console.error("  Provisioning profile:", extensionProvisioningProfile);
            isValid = false;
          }
          const hasEligibleCert = profiles.some((p) =>
            p.developerCertificates.includes(config.macos!.signingCertificate!),
          );
          if (!hasEligibleCert) {
            console.error(
              `❌ Signing certificate does not match provisioning profile. Ensure you have the correct provisioning profiles installed, and ask BRE to add your certificate to the provision profile if the issue persists.`,
            );
            console.error("  Provisioning profile:", extensionProvisioningProfile);
            console.error("  Signing certificate:", config.macos?.signingCertificate);
            isValid = false;
          }
          // TODO: try looking up profiles from the current directory and copy them into the right place.
        }
        config.derived.macos!.autofillExtensionProvisioningProfile = extensionProvisioningProfile;
        config.derived.macos!.autofillExtensionAppId = autofillExtensionAppId;
        console.log("Autofill extension App ID:", autofillExtensionAppId);
        console.log("Autofill extension provisioning profile :", extensionProvisioningProfile);
      }
    }
    config.features.autofillExtension = options.withAutofillExtension;
    console.log("Autofill extension enabled:", options.withAutofillExtension);

    const orderedTasks = getDependencyOrder(tasks);
    config.targets = orderedTasks.map((t) => t.targetName);

    for (const task of tasks) {
      await task.validate(config);
    }

    if (!isValid) {
      console.error("❌ Configuration is not valid.");
      process.exit(1);
    }

    // Write config file
    mkdirSync(config.buildDir, { recursive: true });
    const configFilePath = path.join(config.buildDir, "build-config.json");
    writeFileSync(configFilePath, JSON.stringify(config));

    // Post-configure steps
    for (const task of orderedTasks) {
      await configureBuildTask(config, task);
    }

    console.log(`Build directory configured at ${config.buildDir}`);
  });

  program.parse();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
