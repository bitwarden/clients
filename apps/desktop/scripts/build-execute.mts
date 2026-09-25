#!/usr/bin/env node

import { mkdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { BuildError, type BuildTask, getBuildDirectories } from "./build-config.mts";
import { Logger } from "./build-support.mts";

import WebpackBuildTask from "../build-app.mts";
import BitwardenMacosProviderBuildTask from "../desktop_native/autofill_provider/build-macos-lib.mts";
import ChromiumImporterBuildTask from "../desktop_native/chromium_importer/build-chromium-importer.mts";
import DesktopProxyBuildTask from "../desktop_native/proxy/build-desktop-proxy.mts";
import NapiBuildTask from "../desktop_native/napi/scripts/build-napi.mts";
import BitwardenMacosAutofillExtensionBuildTask from "../macos/Scripts/build-autofill-extension.mts";

const ALL_TARGETS: BuildTask[] = [
  BitwardenMacosAutofillExtensionBuildTask,
  BitwardenMacosProviderBuildTask,
  ChromiumImporterBuildTask,
  DesktopProxyBuildTask,
  NapiBuildTask,
  WebpackBuildTask,
];

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";

async function main() {
  const { Command, Option } = await import("commander");

  const program = new Command();
  program.name("build-config").description("CLI to create build the desktop project");

  program.addOption(
    new Option("-C, --build-dir <path>", "Path to the build directory to use").makeOptionMandatory(
      true,
    ),
  );

  program.action(async (options) => {
    const buildDir = path.resolve(options.buildDir);

    const configPath = path.join(buildDir, "build-config.json");
    const configFile = readFileSync(configPath, { encoding: "utf-8" });
    const config = JSON.parse(configFile);
    const allTargets: Record<string, BuildTask> = {};
    for (const t of ALL_TARGETS) {
      allTargets[t.targetName] = t;
    }
    for (const target of config.targets) {
      const task = allTargets[target];
      if (!task) {
        throw new BuildError(`Unknown target ${target}`);
      }

      if (IS_GITHUB_ACTIONS) {
        console.log(`::group::Build ${target}`);
      }

      const { outputDir, privateDir } = getBuildDirectories(config, task);
      mkdirSync(outputDir, { recursive: true });
      mkdirSync(privateDir, { recursive: true });

      Logger.log(`Building ${target}`);
      await task.build(config, outputDir, privateDir);
      if (IS_GITHUB_ACTIONS) {
        console.log("::endgroup::");
      }
    }
  });

  program.parse();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
