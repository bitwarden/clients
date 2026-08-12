import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { app } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  AgentAppBundleProbe,
  AgentDetectionProbe,
  AgentDetectionProbeKind,
  AgentDetectionProbeResult,
  AgentDetectionResult,
  AgentExecutableProbe,
  AgentPathProbe,
} from "../models/agent-detection";
import { AgentDefinition, SUPPORTED_AGENTS } from "../models/agent-registry";

import { resolvePathSpec } from "./agent-access-path-resolver";

/** Minimal fs surface this service needs, injected so tests never touch the real filesystem or
 *  need to `jest.mock("fs")`. `AgentDetectionService.default` below wires up the real
 *  implementation for production use. */
export interface AgentDetectionFs {
  exists(path: string): Promise<boolean>;
}

const nodeFs: AgentDetectionFs = {
  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

/** Windows candidates tried for a bare executable name. Detection only ever does a PATH scan (see
 *  `runExecutableProbe` below) — it never spawns anything, and a shell-less environment doesn't
 *  apply PATHEXT the way a shell would, so npm-installed CLIs shipped as `.cmd` shims (the default
 *  for global npm installs on Windows) would otherwise never be found by a plain filename check. */
function executableCandidates(name: string): string[] {
  return process.platform === "win32"
    ? [name, `${name}.cmd`, `${name}.exe`, `${name}.bat`]
    : [name];
}

/**
 * Detects which supported AI coding agent clients (`models/agent-registry.ts`) are installed on
 * this machine, by running each agent's declarative detection probes (agent-access-architecture
 * .md, "M3 — multi-agent support"). Cross-platform: probes are filtered/resolved per
 * `process.platform`.
 *
 * Never throws: a missing file, a failed spawn, or any other probe error is treated as "this probe
 * didn't match" rather than propagated, so one bad probe can't take down detection for every other
 * agent. Never logs file contents — only paths and error objects.
 */
export class AgentDetectionService {
  constructor(
    private logService: LogService,
    private homedir: string = os.homedir(),
    // `app.getPath("appData")` is only ever evaluated when a caller omits this argument (production
    // wiring); every test injects a plain string instead, so tests never touch Electron.
    private appDataPath: string = app.getPath("appData"),
    private fsAdapter: AgentDetectionFs = nodeFs,
    private agentDefinitions: AgentDefinition[] = SUPPORTED_AGENTS,
  ) {}

  async detectAgents(): Promise<AgentDetectionResult[]> {
    return Promise.all(this.agentDefinitions.map((definition) => this.detectAgent(definition)));
  }

  async detectAgent(definition: AgentDefinition): Promise<AgentDetectionResult> {
    const probeResults: AgentDetectionProbeResult[] = [];
    for (const probe of definition.detectionProbes) {
      probeResults.push({ probe, matched: await this.runProbe(probe) });
    }

    return {
      agentId: definition.id,
      detected: probeResults.some((result) => result.matched),
      probeResults,
    };
  }

  private async runProbe(probe: AgentDetectionProbe): Promise<boolean> {
    try {
      switch (probe.kind) {
        case AgentDetectionProbeKind.Executable:
          return await this.runExecutableProbe(probe);
        case AgentDetectionProbeKind.Path:
          return await this.runPathProbe(probe);
        case AgentDetectionProbeKind.AppBundle:
          return await this.runAppBundleProbe(probe);
        default: {
          // Exhaustiveness check: a new AgentDetectionProbe kind was added without a case here.
          const unreachable: never = probe;
          throw new Error(`Unhandled detection probe kind: ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (e) {
      this.logService.warning(`[Agent Access] Detection probe "${probe.description}" failed: ${e}`);
      return false;
    }
  }

  // Presence-only check: scans `PATH` for the candidate filenames without ever executing
  // anything. This feature's threat model is "an AI agent that can request vault credentials",
  // so passively executing a binary that merely happens to be named e.g. `gemini` on the user's
  // PATH (as the old `<agent> --version` probe did) is not an acceptable cost for a presence
  // check — a PATH scan gets the same answer with no code execution and no process-spawn cost.
  private async runExecutableProbe(probe: AgentExecutableProbe): Promise<boolean> {
    const pathEnv = process.env.PATH;
    if (pathEnv == null || pathEnv.length === 0) {
      return false;
    }

    const directories = pathEnv.split(path.delimiter).filter((dir) => dir.length > 0);
    const candidates = executableCandidates(probe.executable);
    for (const directory of directories) {
      for (const candidate of candidates) {
        if (await this.fsAdapter.exists(path.join(directory, candidate))) {
          return true;
        }
      }
    }
    return false;
  }

  private async runPathProbe(probe: AgentPathProbe): Promise<boolean> {
    const resolved = resolvePathSpec(probe, {
      homedir: this.homedir,
      appDataPath: this.appDataPath,
    });
    if (resolved == null) {
      return false;
    }
    return this.fsAdapter.exists(resolved);
  }

  private async runAppBundleProbe(probe: AgentAppBundleProbe): Promise<boolean> {
    if (process.platform !== "darwin") {
      return false;
    }
    return this.fsAdapter.exists(path.join("/Applications", probe.macAppName));
  }
}
