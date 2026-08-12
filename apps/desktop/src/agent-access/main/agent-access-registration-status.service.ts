import { promises as fs } from "fs";
import * as os from "os";

import { app } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  AgentReadOnlyStatusConfig,
  AgentStatusConfigFormat,
  FileMergeConfigPathSpec,
  FileMergeRegistrationStrategy,
  McpRegistrationStrategyKind,
} from "../models/agent-registration";
import {
  AgentRegistrationStatus,
  AgentRegistrationStatusResult,
} from "../models/agent-registration-status";
import { AgentDefinition, SUPPORTED_AGENTS } from "../models/agent-registry";
import { BITWARDEN_MCP_SERVER_NAME } from "../models/mcp-config";

import { findMatchingPathSpec, resolvePathSpec } from "./agent-access-path-resolver";

/**
 * Read-only fs surface this service needs — deliberately narrower than
 * `AgentAccessRegistrationFs` in `agent-access-registration.service.ts`, which also exposes
 * `writeFile`/`mkdir`. This service must never write anything, so its injected dependency simply
 * has no write methods to call. A concrete `AgentAccessRegistrationFs` (and its test mocks)
 * satisfies this interface structurally, so the same instance/mock used by the write path can be
 * passed straight through here, letting tests additionally assert its write methods are never
 * invoked as defense in depth.
 */
export interface AgentAccessRegistrationStatusFs {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
}

const nodeFs: AgentAccessRegistrationStatusFs = {
  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  readFile: (filePath) => fs.readFile(filePath, "utf8"),
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Answers "is the Bitwarden MCP server already registered with this agent?" for every supported
 * agent (`models/agent-registry.ts`), purely by reading each agent's own config file —
 * agent-access-architecture.md, "M3 — multi-agent support". Backs the UI's persistent "Connected"
 * state, which needs to survive app restarts without re-running `registerWithAgent`.
 *
 * Security/reliability invariants:
 *  - Never writes anything: no file writes, no `.bak`, no `mkdir`, no process spawning. The
 *    injected `AgentAccessRegistrationStatusFs` doesn't even expose write methods.
 *  - Never throws: a missing file, an unreadable file, a malformed/unparseable config, or an
 *    unsupported format all resolve to `AgentRegistrationStatus.Unknown` rather than propagating —
 *    one bad config must never break status for the other four agents.
 *  - Never shells out and never spawns anything. Detection was deliberately changed to stop
 *    executing binaries (see the threat-model comment in `agent-detection.service.ts`), and
 *    registration was deliberately changed to stop spawning agent CLIs at all (see the doc comment
 *    on `models/agent-registration.ts`) — this service reads every agent's own config file
 *    directly, via `AgentDefinition.readOnlyStatusConfig`, regardless of that agent's write
 *    strategy (`Deeplink`, `ManualCommand`, or `FileMerge`). This is the *only* way to close the
 *    loop for a `Deeplink`/`ManualCommand` agent: this app never performs their write, so reading
 *    the result back is the only way to know whether it happened.
 *  - Never logs file contents — only paths and error objects.
 */
export class AgentAccessRegistrationStatusService {
  constructor(
    private logService: LogService,
    private homedir: string = os.homedir(),
    // `app.getPath("appData")` is only ever evaluated when a caller omits this argument (production
    // wiring); every test injects a plain string instead, so tests never touch Electron.
    private appDataPath: string = app.getPath("appData"),
    private fsAdapter: AgentAccessRegistrationStatusFs = nodeFs,
    private agentDefinitions: AgentDefinition[] = SUPPORTED_AGENTS,
  ) {}

  async getAgentRegistrationStatuses(): Promise<AgentRegistrationStatusResult[]> {
    return Promise.all(
      this.agentDefinitions.map((definition) => this.getAgentRegistrationStatus(definition)),
    );
  }

  private async getAgentRegistrationStatus(
    definition: AgentDefinition,
  ): Promise<AgentRegistrationStatusResult> {
    try {
      const status = await this.resolveStatus(definition);
      return { agentId: definition.id, status };
    } catch (e) {
      // Belt-and-suspenders: every branch below already resolves errors to `Unknown` on its own,
      // but a bug in any of them must never propagate and take down status for the other agents.
      this.logService.warning(
        `[Agent Access] Failed to resolve registration status for ${definition.displayName}`,
        e,
      );
      return { agentId: definition.id, status: AgentRegistrationStatus.Unknown };
    }
  }

  private async resolveStatus(definition: AgentDefinition): Promise<AgentRegistrationStatus> {
    // `readOnlyStatusConfig` is the primary source for every agent regardless of write strategy —
    // see the class doc comment. It's declared explicitly for all five current agents.
    if (definition.readOnlyStatusConfig != null) {
      return this.resolveConfigStatus(definition.readOnlyStatusConfig, definition.displayName);
    }

    // Fallback for a `FileMerge`-primary agent that doesn't bother declaring an explicit
    // `readOnlyStatusConfig`: the same `configPaths`/`serversKey` the write path merges into is
    // also exactly where a status probe should look, so there's no need to duplicate it.
    if (definition.registrationStrategy.kind === McpRegistrationStrategyKind.FileMerge) {
      return this.resolveFileMergeStatus(definition.registrationStrategy, definition.displayName);
    }

    return AgentRegistrationStatus.Unknown;
  }

  private async resolveFileMergeStatus(
    strategy: FileMergeRegistrationStrategy,
    displayName: string,
  ): Promise<AgentRegistrationStatus> {
    const configPath = this.resolveConfigPath(findMatchingPathSpec(strategy.configPaths));
    if (configPath == null) {
      return AgentRegistrationStatus.Unknown;
    }
    return this.resolveJsonStatus(configPath, strategy.serversKey, displayName);
  }

  private async resolveConfigStatus(
    config: AgentReadOnlyStatusConfig,
    displayName: string,
  ): Promise<AgentRegistrationStatus> {
    const configPath = this.resolveConfigPath(config.configPath);
    if (configPath == null) {
      return AgentRegistrationStatus.Unknown;
    }

    switch (config.format) {
      case AgentStatusConfigFormat.Json:
        return this.resolveJsonStatus(configPath, config.serversKey, displayName);
      case AgentStatusConfigFormat.TomlSection:
        return this.resolveTomlSectionStatus(configPath, config.table, displayName);
      default: {
        // Exhaustiveness check: a new AgentStatusConfigFormat was added without a case here.
        const unreachable: never = config;
        throw new Error(`Unhandled status config format: ${JSON.stringify(unreachable)}`);
      }
    }
  }

  private resolveConfigPath(spec: FileMergeConfigPathSpec | null): string | null {
    if (spec == null) {
      return null;
    }
    return resolvePathSpec(spec, { homedir: this.homedir, appDataPath: this.appDataPath });
  }

  private async resolveJsonStatus(
    configPath: string,
    serversKey: string,
    displayName: string,
  ): Promise<AgentRegistrationStatus> {
    const raw = await this.readConfigOrNull(configPath, displayName);
    if (raw == null) {
      return AgentRegistrationStatus.Unknown;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.logService.warning(`[Agent Access] ${displayName}'s config is not valid JSON`, e);
      return AgentRegistrationStatus.Unknown;
    }

    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return AgentRegistrationStatus.Unknown;
    }

    const servers = (parsed as Record<string, unknown>)[serversKey];
    if (servers == null || typeof servers !== "object" || Array.isArray(servers)) {
      return AgentRegistrationStatus.NotRegistered;
    }

    return (servers as Record<string, unknown>)[BITWARDEN_MCP_SERVER_NAME] != null
      ? AgentRegistrationStatus.Registered
      : AgentRegistrationStatus.NotRegistered;
  }

  private async resolveTomlSectionStatus(
    configPath: string,
    table: string,
    displayName: string,
  ): Promise<AgentRegistrationStatus> {
    const raw = await this.readConfigOrNull(configPath, displayName);
    if (raw == null) {
      return AgentRegistrationStatus.Unknown;
    }

    const headerPattern = new RegExp(
      `^\\s*\\[\\s*${escapeRegExp(table)}\\s*\\.\\s*${escapeRegExp(BITWARDEN_MCP_SERVER_NAME)}\\s*\\]\\s*$`,
      "m",
    );
    if (headerPattern.test(raw)) {
      return AgentRegistrationStatus.Registered;
    }

    // Fail-safe: this is a targeted text scan, not a real TOML parser. If the server name shows up
    // somewhere near the table name but didn't match the exact section-header shape above (odd
    // spacing, a truncated header, a comment, an inline table, ...), we can't rule out that it IS
    // registered just because our scan didn't match — surface "unknown" rather than guessing
    // "not registered". Only report a confident "not registered" when neither string appears at
    // all near each other in the file.
    const ambiguous = raw.includes(BITWARDEN_MCP_SERVER_NAME) && raw.includes(table);
    return ambiguous ? AgentRegistrationStatus.Unknown : AgentRegistrationStatus.NotRegistered;
  }

  private async readConfigOrNull(configPath: string, displayName: string): Promise<string | null> {
    try {
      if (!(await this.fsAdapter.exists(configPath))) {
        return null;
      }
      return await this.fsAdapter.readFile(configPath);
    } catch (e) {
      this.logService.warning(
        `[Agent Access] Failed to read ${displayName}'s config for status`,
        e,
      );
      return null;
    }
  }
}
