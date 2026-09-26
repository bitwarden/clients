#!/usr/bin/env node
/* eslint-disable no-console */

/// Front door for the desktop build.
///
/// Every step is its own script, because each one is a different job with a different set of
/// prerequisites and they have to be runnable individually -- a CI job that only builds the
/// proxy should not have to know how to skip everything else. That does mean the commands to
/// run a build by hand are long and have to be remembered, which is what this is for.
///
/// It only forwards: each command below runs the same script, with the same arguments, that a
/// caller naming the script directly would. `bw-task build` with no target runs them all,
/// which is safe because a build script whose target is not in the configuration does nothing.
///
/// Usage:
///   bw-task configure --build-dir build-mac --architecture arm64 --distribution-channel dmg
///   bw-task build --build-dir build-mac
///   bw-task build napi desktop-proxy --build-dir build-mac
///   bw-task pack --build-dir build-mac

import { execFileSync } from "child_process";
import path from "path";

import { BuildError, TARGETS, targetName } from "./build-config.mts";
import { runScript } from "./build-support.mts";

const scriptsDir = import.meta.dirname;

interface Step {
  name: string;
  script: string;
  /// Where it applies, for the target list in the help output.
  applies: string;
}

/// The app source is not an optional target -- every configuration contains it -- so it has no
/// entry in TARGETS and is named here instead.
const APP_STEP: Step = {
  name: "app",
  script: "build-app.mts",
  applies: "all platforms",
};

const BUILD_STEPS: Step[] = [
  APP_STEP,
  ...TARGETS.map((target) => ({
    name: targetName(target),
    script: target.script,
    applies: target.platforms.join(", "),
  })),
];

runScript(() => {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "configure":
      run("configure.mts", rest);
      return;
    case "build":
      build(rest);
      return;
    case "pack":
      run("pack.mts", rest);
      return;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(usage());
      return;
    default:
      throw new BuildError(`Unknown command '${command}'.\n\n${usage()}`);
  }
});

/// Targets come before flags, so that a flag's value is never mistaken for a target name.
function build(args: string[]): void {
  const named: string[] = [];
  let index = 0;
  for (; index < args.length && !args[index].startsWith("-"); index += 1) {
    named.push(args[index]);
  }
  const forwarded = args.slice(index);

  const steps = named.length === 0 ? BUILD_STEPS : named.map(step);
  for (const { name, script } of steps) {
    console.log(`\n==> build ${name}`);
    if (!run(script, forwarded)) {
      return;
    }
  }
}

function step(name: string): Step {
  const found = BUILD_STEPS.find((candidate) => candidate.name === name);
  if (found == null) {
    throw new BuildError(
      `Unknown build target '${name}'. Known targets: ` +
        `${BUILD_STEPS.map((candidate) => candidate.name).join(", ")}.`,
    );
  }
  return found;
}

/// Runs a script in the caller's working directory, which is where --build-dir is resolved
/// from, so that a path typed here means the same directory it would mean to the shell.
///
/// Reports whether it succeeded rather than throwing: the script inherited stdio and has
/// already said what went wrong, and a second message on top of it would only bury the first.
function run(script: string, args: string[]): boolean {
  const scriptPath = path.join(scriptsDir, script);
  console.log(`> node ${shortestPath(scriptPath)} ${args.join(" ")}`.trimEnd());
  try {
    execFileSync(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
    return true;
  } catch (error) {
    const status = (error as { status?: number }).status;
    process.exitCode = typeof status === "number" && status !== 0 ? status : 1;
    return false;
  }
}

/// The echoed command is there to be copied and re-run, so it is spelled whichever way is
/// shorter -- a relative path climbing out of an unrelated directory is neither.
function shortestPath(target: string): string {
  const relative = path.relative(process.cwd(), target);
  return relative.length < target.length ? relative : target;
}

function usage(): string {
  const targets = BUILD_STEPS.map((target) => `  ${target.name.padEnd(28)} ${target.applies}`).join(
    "\n",
  );

  return [
    "Usage: bw-task <command> [target...] [options]",
    "",
    "Commands:",
    "  configure [options]          Record what a build should contain in <build-dir>",
    "  build [target...]            Build targets; with none, every configured target",
    "  pack                         Package what the build steps produced",
    "  help                         Show this message",
    "",
    "Options are passed through unchanged; --build-dir <dir> is resolved from the current",
    "directory. Run a command with --help for its own options.",
    "",
    "Build targets:",
    targets,
    "",
    "A target that is not part of the configuration is skipped, so `bw-task build` is safe to",
    "run over any build directory.",
  ].join("\n");
}
