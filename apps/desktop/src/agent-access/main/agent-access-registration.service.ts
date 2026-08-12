import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { app } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AgentId, isAgentId } from "../models/agent-id";
import {
  FileMergeRegistrationStrategy,
  McpRegistrationStrategyKind,
  RegisterWithAgentResult,
  RegisterWithAgentStatus,
} from "../models/agent-registration";
import { AGENT_DEFINITIONS, AgentDefinition } from "../models/agent-registry";
import {
  BITWARDEN_MCP_SERVER_NAME,
  McpServerEntry,
  buildBitwardenMcpServerEntry,
} from "../models/mcp-config";

import { findMatchingPathSpec, resolvePathSpec } from "./agent-access-path-resolver";

/** Minimal fs surface this service needs, injected so tests never touch the real filesystem or
 *  need to `jest.mock("fs")`. `AgentAccessRegistrationService.default` below wires up the real
 *  implementation for production use. Adds `mkdir` (a file-merge target's parent directory, e.g.
 *  `~/.cursor/`, isn't guaranteed to exist the way `~/` always is) and `rename` (for the atomic
 *  write below) on top of the plain read/write/exists surface a config-file writer needs. */
export interface AgentAccessRegistrationFs {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
}

const nodeFs: AgentAccessRegistrationFs = {
  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  readFile: (filePath) => fs.readFile(filePath, "utf8"),
  writeFile: (filePath, data) => fs.writeFile(filePath, data, "utf8"),
  mkdir: async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
  },
  rename: (oldPath, newPath) => fs.rename(oldPath, newPath),
};

function entriesEqual(a: McpServerEntry, b: McpServerEntry): boolean {
  // Existing entries come from a user/vendor-written config file, not from this app, so `args`
  // isn't guaranteed to be an array — a `{ url: ... }` (Deeplink-style) or bare `{ command: ... }`
  // entry has no `args` at all. `a.args.length`/`a.args.every` would throw a TypeError in that
  // case, propagating a raw IPC error instead of a `RegisterWithAgentResult`. Guard with
  // `Array.isArray`: a falsy/non-array `args` is simply treated as "not equal", which routes into
  // the normal overwrite path below rather than crashing.
  return (
    a.command === b.command &&
    Array.isArray(a.args) &&
    Array.isArray(b.args) &&
    a.args.length === b.args.length &&
    a.args.every((v, i) => v === b.args[i])
  );
}

/**
 * Writes the bundled `aac mcp` server into a `FileMerge`-strategy agent's own JSON config file
 * (agent-access-architecture.md, "M3 — multi-agent support"), generalizing the read-merge-write
 * approach the removed M2 Claude-Code-only onboarding flow used.
 *
 * `FileMerge` is the only strategy this service ever writes through, but that includes two cases:
 * an agent whose top-level `registrationStrategy.kind` IS `FileMerge`, and a `Deeplink` agent's
 * declared `fallback` (see `DeeplinkRegistrationStrategy.fallback` in `models/agent-registration
 * .ts`) — e.g. Copilot's VS Code install URI gives no completion signal, so if `launchUri` fails
 * silently (VS Code not installed, or not registered as the `vscode:` handler), the fallback is the
 * user's only recourse. `registerWithAgent` below resolves that fallback automatically when called
 * for such an agent; the caller decides *when* to call it — the UI surfaces it as an explicit
 * secondary action ("VS Code didn't open? Write the config directly"), never as an automatic retry,
 * so this app never writes to a user's config file as a silent side effect of a deeplink it can't
 * confirm failed. `ManualCommand` agents (see `models/agent-registration.ts`) and `Deeplink` agents
 * with no fallback are registered without this app ever touching the agent's config file at all —
 * `registerWithAgent` returns a clear `Error` result, without writing anything, for those.
 *
 * Every safety behavior from that removed flow is preserved: read-if-exists, refuse to write on
 * invalid/non-object JSON, merge only the configured servers key while preserving every other
 * top-level key, write a `.bak` backup before overwriting, and report `alreadyPresent` when the
 * entry already matches exactly. New here: the final write is atomic — the new config is
 * written to a temp file in the same directory, then moved into place with `fs.rename` (an atomic
 * replace on POSIX and Windows alike within the same volume), so a crash or power loss mid-write
 * can never leave the user's agent config truncated or half-written.
 *
 * Never logs file contents (parsed or raw) — only paths and error objects.
 */
export class AgentAccessRegistrationService {
  constructor(
    private logService: LogService,
    private homedir: string = os.homedir(),
    // `app.getPath("appData")` is only ever evaluated when a caller omits this argument (production
    // wiring); every test injects a plain string instead, so tests never touch Electron.
    private appDataPath: string = app.getPath("appData"),
    private fsAdapter: AgentAccessRegistrationFs = nodeFs,
    private agentDefinitions: Record<AgentId, AgentDefinition> = AGENT_DEFINITIONS,
  ) {}

  async registerWithAgent(
    agentId: AgentId,
    bundledCliPath: string | null,
  ): Promise<RegisterWithAgentResult> {
    if (bundledCliPath == null) {
      return {
        status: RegisterWithAgentStatus.Error,
        message: "The bundled Agent Access CLI could not be found.",
      };
    }
    if (!isAgentId(agentId)) {
      return { status: RegisterWithAgentStatus.Error, message: "Unknown agent." };
    }

    const definition = this.agentDefinitions[agentId];
    const entry = buildBitwardenMcpServerEntry(bundledCliPath);

    const fileMergeStrategy = this.resolveFileMergeStrategy(definition);
    if (fileMergeStrategy == null) {
      return {
        status: RegisterWithAgentStatus.Error,
        message: `${definition.displayName} isn't registered by writing a file from Bitwarden — use the setup command or install link on the Agent Access page instead.`,
      };
    }

    return this.registerViaFileMerge(fileMergeStrategy, definition.displayName, entry);
  }

  /**
   * Resolves the `FileMergeRegistrationStrategy` `registerWithAgent` should write through, or
   * `null` if this agent has no write path this app controls at all:
   *  - A `FileMerge`-primary agent uses its own strategy directly.
   *  - A `Deeplink`-primary agent uses its declared `fallback`, if any — see that field's doc
   *    comment on `DeeplinkRegistrationStrategy` for why this is safe to resolve automatically
   *    (the caller still decides *when* to invoke it; this method only decides *what* to write).
   *  - Everything else (a `ManualCommand`-primary agent, or a `Deeplink`-primary agent with no
   *    fallback) returns `null` — the user's own terminal/vendor app owns that write, not this app.
   */
  private resolveFileMergeStrategy(
    definition: AgentDefinition,
  ): FileMergeRegistrationStrategy | null {
    const strategy = definition.registrationStrategy;
    if (strategy.kind === McpRegistrationStrategyKind.FileMerge) {
      return strategy;
    }
    if (strategy.kind === McpRegistrationStrategyKind.Deeplink && strategy.fallback != null) {
      return strategy.fallback;
    }
    return null;
  }

  private async registerViaFileMerge(
    strategy: FileMergeRegistrationStrategy,
    displayName: string,
    entry: McpServerEntry,
  ): Promise<RegisterWithAgentResult> {
    const configPath = this.resolveFileMergeConfigPath(strategy);
    if (configPath == null) {
      return {
        status: RegisterWithAgentStatus.Error,
        message: `${displayName} isn't supported on this platform.`,
      };
    }

    let raw: string | null = null;
    try {
      if (await this.fsAdapter.exists(configPath)) {
        raw = await this.fsAdapter.readFile(configPath);
      }
    } catch (e) {
      this.logService.error(`[Agent Access] Failed to read ${displayName}'s config`, e);
      return {
        status: RegisterWithAgentStatus.Error,
        message: `Couldn't read ${displayName}'s configuration file.`,
      };
    }

    // Tolerate a missing file (start from `{}`); never overwrite a file that exists but couldn't
    // be parsed — a merge into unknown content risks destroying whatever else lives there.
    let parsed: Record<string, unknown> = {};
    if (raw != null) {
      try {
        const candidate: unknown = JSON.parse(raw);
        if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) {
          throw new Error(`${displayName} config root is not a JSON object`);
        }
        parsed = candidate as Record<string, unknown>;
      } catch (e) {
        this.logService.error(
          `[Agent Access] ${displayName}'s config is not valid JSON; refusing to modify it`,
          e,
        );
        return {
          status: RegisterWithAgentStatus.Error,
          message: `${displayName}'s configuration file couldn't be parsed, so it wasn't changed.`,
        };
      }
    }

    const serversKey = strategy.serversKey;
    const existingServersRaw = parsed[serversKey];
    const servers: Record<string, McpServerEntry> =
      existingServersRaw != null &&
      typeof existingServersRaw === "object" &&
      !Array.isArray(existingServersRaw)
        ? { ...(existingServersRaw as Record<string, McpServerEntry>) }
        : {};

    const existingEntry = servers[BITWARDEN_MCP_SERVER_NAME];
    if (existingEntry != null && entriesEqual(existingEntry, entry)) {
      return { status: RegisterWithAgentStatus.AlreadyPresent };
    }

    const wasPresent = existingEntry != null;
    servers[BITWARDEN_MCP_SERVER_NAME] = entry;
    // Only the configured servers key is touched; every other top-level key in the file is carried
    // through unchanged.
    const nextConfig = { ...parsed, [serversKey]: servers };

    if (raw != null) {
      try {
        await this.fsAdapter.writeFile(`${configPath}.bak`, raw);
      } catch (e) {
        this.logService.error(`[Agent Access] Failed to back up ${displayName}'s config`, e);
        return {
          status: RegisterWithAgentStatus.Error,
          message: `Couldn't back up ${displayName}'s configuration file.`,
        };
      }
    }

    // Atomic write: the new content lands fully-formed at `tempPath` first, then `rename` swaps it
    // into place in one filesystem operation. A crash between these two steps leaves either the old
    // config untouched or the temp file orphaned — never a half-written `configPath`.
    const tempPath = `${configPath}.tmp`;
    try {
      await this.fsAdapter.mkdir(path.dirname(configPath));
      await this.fsAdapter.writeFile(tempPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
      await this.fsAdapter.rename(tempPath, configPath);
    } catch (e) {
      this.logService.error(`[Agent Access] Failed to write ${displayName}'s config`, e);
      return {
        status: RegisterWithAgentStatus.Error,
        message: `Couldn't write ${displayName}'s configuration file.`,
      };
    }

    return { status: wasPresent ? RegisterWithAgentStatus.Updated : RegisterWithAgentStatus.Added };
  }

  private resolveFileMergeConfigPath(strategy: FileMergeRegistrationStrategy): string | null {
    const spec = findMatchingPathSpec(strategy.configPaths);
    return spec == null
      ? null
      : resolvePathSpec(spec, { homedir: this.homedir, appDataPath: this.appDataPath });
  }
}
