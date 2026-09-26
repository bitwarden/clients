/// Probes the local toolchain for what a configured build will need.
///
/// desktop_native/build.js installs missing pieces as it goes; configure reports them instead,
/// so a machine that cannot finish the build says so before anything is built and names the
/// command that fixes it.

import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

import type { CrossCompilationPlan } from "./rust-targets.mts";

const desktopNativeDir = path.resolve(import.meta.dirname, "../desktop_native");

export interface ToolchainReport {
  errors: string[];
  warnings: string[];
}

/// Version pinned under [workspace.metadata.bin] in desktop_native/Cargo.toml, so that file
/// stays the only place tool versions are written down.
export function pinnedBinVersion(tool: string): string | undefined {
  const cargoToml = readFileSync(path.join(desktopNativeDir, "Cargo.toml"), "utf8");
  const match = new RegExp(`^${tool}\\s*=\\s*\\{\\s*version\\s*=\\s*"=?([^"]+)"`, "m").exec(
    cargoToml,
  );
  return match?.[1];
}

/// Installed rust targets, or undefined when rustup itself is missing.
///
/// Probed from desktop_native, because rust-toolchain.toml there pins the toolchain cargo will
/// actually build with, and each toolchain has its own set of installed targets.
export function installedRustTargets(): string[] | undefined {
  const output = run(["rustup", "target", "list", "--installed"]);
  return output
    ?.split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function verifyToolchain(plan: CrossCompilationPlan): ToolchainReport {
  const report: ToolchainReport = { errors: [], warnings: [] };

  if (plan.unsupported.length > 0) {
    // No point reporting missing tools for a combination that has no path to a build at all.
    report.errors.push(...plan.unsupported);
    return report;
  }

  const installed = installedRustTargets();
  if (installed == null) {
    report.errors.push("rustup was not found on PATH. Install it from https://rustup.rs");
  } else {
    for (const target of plan.targets) {
      if (!installed.includes(target)) {
        report.errors.push(
          `rust target '${target}' is not installed.\n` +
            `       Install it with: rustup target add ${target}`,
        );
      }
    }
  }

  for (const tool of plan.tools) {
    const pinned = tool.pinnedAs == null ? undefined : pinnedBinVersion(tool.pinnedAs);
    const install = tool.install.replace("{version}", pinned ?? "<pinned version>");
    const version = probeVersion(tool.probe);

    if (version == null) {
      report.errors.push(
        `${tool.tool} is required to build for this configuration but was not found.\n` +
          `       Install it with: ${install}`,
      );
    } else if (pinned != null && !version.includes(pinned)) {
      report.warnings.push(
        `${tool.tool} reports '${version}', but ${pinned} is pinned in ` +
          "desktop_native/Cargo.toml. Reinstall it with: " +
          install,
      );
    }
  }

  return report;
}

/// First line of a version command, or undefined when the command is missing or fails.
/// Probing is best effort: a tool that cannot report a version is treated as absent.
function probeVersion(command: readonly string[]): string | undefined {
  return run(command)?.split("\n")[0]?.trim();
}

function run(command: readonly string[]): string | undefined {
  const [bin, ...args] = command;
  try {
    return execFileSync(bin, args, {
      cwd: desktopNativeDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}
