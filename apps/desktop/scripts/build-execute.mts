#!/usr/bin/env node

import { mkdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  BuildError,
  type BuildConfig,
  type BuildTask,
  getBuildDirectories,
} from "./build-config.mts";
import { Logger } from "./build-support.mts";

import ElectronBuildTask from "../build-electron.mts";
import WebpackBuildTask from "../build-app.mts";
import BitwardenMacosProviderBuildTask from "../desktop_native/autofill_provider/build-macos-lib.mts";
import ChromiumImporterBuildTask from "../desktop_native/chromium_importer/build-chromium-importer.mts";
import ProcessIsolationBuildTask from "../desktop_native/process_isolation/build-process-isolation.mts";
import DesktopProxyBuildTask from "../desktop_native/proxy/build-desktop-proxy.mts";
import NapiBuildTask from "../desktop_native/napi/scripts/build-napi.mts";
import NapiTypesBuildTask from "../desktop_native/napi/scripts/build-napi-types.mts";
import RustBuildTask from "../desktop_native/build-rust.mts";
import BitwardenMacosAutofillExtensionBuildTask from "../macos/Scripts/build-autofill-extension.mts";

const ALL_TARGETS: BuildTask[] = [
  BitwardenMacosAutofillExtensionBuildTask,
  BitwardenMacosProviderBuildTask,
  ChromiumImporterBuildTask,
  ProcessIsolationBuildTask,
  DesktopProxyBuildTask,
  RustBuildTask,
  NapiTypesBuildTask,
  NapiBuildTask,
  WebpackBuildTask,
  ElectronBuildTask,
];

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";

async function main() {
  const { Command, InvalidArgumentError, Option } = await import("commander");

  const program = new Command();
  program.name("build-config").description("CLI to create build the desktop project");

  program.addOption(
    new Option("-C, --build-dir <path>", "Path to the build directory to use").makeOptionMandatory(
      true,
    ),
  );

  program.addOption(
    new Option(
      "-j, --jobs <count>",
      "Number of tasks to run at once. Grouped CI logs need 1, since the output of concurrent tasks interleaves.",
    )
      .argParser((value) => {
        const jobs = Number.parseInt(value, 10);
        if (!(jobs >= 1)) {
          throw new InvalidArgumentError("Must be a positive integer.");
        }
        return jobs;
      })
      .default(Infinity, "unlimited"),
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
    const tasks = config.targets.map((target: string) => {
      const task = allTargets[target];
      if (!task) {
        throw new BuildError(`Unknown target ${target}`);
      }
      return task;
    });
    await buildTasks(config, tasks, options.jobs);
  });

  program.parse();
}

/// Stands in for the error of a task that did not run because another one failed, so that only
/// real failures are reported.
class TaskSkipped extends Error {}

/**
 * Builds `tasks`, starting each as soon as the enabled tasks it depends on have finished, with at
 * most `jobs` running at once. After a failure no new task starts, but those already running are
 * allowed to finish.
 *
 * @param tasks Tasks to build, ordered so that each comes after its dependencies, as
 *   `config.targets` is.
 */
async function buildTasks(config: BuildConfig, tasks: BuildTask[], jobs: number): Promise<void> {
  const enabled = new Set(tasks.map((task) => task.targetName));
  const limit = createLimiter(jobs);
  const results = new Map<string, Promise<void>>();
  const errors: unknown[] = [];

  for (const task of tasks) {
    const dependencies = task.dependencies
      .filter((dependency) => enabled.has(dependency.targetName))
      .map((dependency) => {
        const result = results.get(dependency.targetName);
        if (result === undefined) {
          throw new BuildError(
            `${task.targetName} is listed before its dependency ${dependency.targetName}; reconfigure the build directory.`,
          );
        }
        return result;
      });

    const result = Promise.all(dependencies)
      .catch(() => {
        throw new TaskSkipped();
      })
      .then(() =>
        limit(async () => {
          if (errors.length > 0) {
            throw new TaskSkipped();
          }
          try {
            await buildTask(config, task, jobs === 1);
          } catch (error) {
            // Recorded before the slot is released, so the next queued task sees it.
            Logger.error(`${task.targetName} failed`);
            errors.push(error);
            throw error;
          }
        }),
      );
    // Failures are collected in `errors`; this only keeps the rejection from going unhandled.
    result.catch(() => {});
    results.set(task.targetName, result);
  }

  await Promise.allSettled(results.values());
  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, `${errors.length} build tasks failed`);
  }
}

async function buildTask(config: BuildConfig, task: BuildTask, groupLogs: boolean): Promise<void> {
  const start = process.hrtime.bigint();
  // GitHub folds everything between the markers into one group, which is only meaningful when
  // nothing else is printing at the same time.
  const group = IS_GITHUB_ACTIONS && groupLogs;
  if (group) {
    console.log(`::group::Build ${task.targetName}`);
  }

  const { outputDir, privateDir } = getBuildDirectories(config, task);
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(privateDir, { recursive: true });

  Logger.log(`Building ${task.targetName}`);
  try {
    await task.build(config, outputDir, privateDir);
  } finally {
    if (group) {
      console.log("::endgroup::");
    }
  }
  const end = process.hrtime.bigint();
  const elapsedNs = end - start;
  const seconds = Number(elapsedNs / 1_000_000n) / 1_000;
  Logger.log(`${task.targetName} completed in ${seconds}s`);
}

/// Returns a function that runs at most `concurrency` of the functions passed to it at a time.
function createLimiter(concurrency: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  return async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      queue.shift()?.();
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
