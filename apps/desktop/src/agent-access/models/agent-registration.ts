/**
 * Declarative per-agent MCP registration strategies (agent-access-architecture.md, "M3 —
 * multi-agent support"). Renderer-safe (no Node imports): strategies are plain data plus pure
 * builder functions describing *what* mechanism to use, not privileged access to *how* to run it —
 * `AgentAccessRegistrationService` in `../main/` is the only place that touches `fs` to perform a
 * `FileMerge` write.
 *
 * Why there is no "spawn the agent's own CLI for us" strategy any more: the previous `Cli` strategy
 * ran e.g. `claude mcp add ...` via `execFile` with a bare executable name (`"claude"`), resolved
 * against `process.env.PATH`. A macOS app launched from the Dock/Finder inherits **launchd's**
 * PATH, not the user's shell PATH — `launchctl getenv PATH` is unset by default, i.e. just
 * `/usr/bin:/bin:/usr/sbin:/sbin`. Neither `claude` (typically `~/.local/bin`) nor `codex`
 * (typically `/opt/homebrew/bin`) lives there, so registration failed with `ENOENT` for every user
 * who launched the app normally; it only appeared to work from a terminal-launched dev instance,
 * which inherits the developer's shell environment. Recovering the login PATH by executing the
 * user's shell rc files (`$SHELL -ilc 'echo $PATH'`) was considered and rejected: running a
 * credential manager's own logic through arbitrary user shell startup scripts is not an acceptable
 * trade, and `agent-detection.service.ts` already made the same call for detection (never execute
 * an agent binary, PATH-scan for its presence instead).
 *
 * `ManualCommand` replaces `Cli`: the user pastes the exact command into their *own* terminal, which
 * runs with their real PATH already loaded — no spawn, no PATH guessing, and the agent's own CLI
 * (not this app) decides which config file and scope the entry lands in. `Deeplink` covers agents
 * whose vendor app owns a URI-based install flow instead of a CLI. `FileMerge` remains the fallback
 * for agents with neither.
 */
import { Utils } from "@bitwarden/common/platform/misc/utils";

import {
  BITWARDEN_MCP_SERVER_NAME,
  McpServerEntry,
  buildBitwardenMcpServerEntry,
} from "./mcp-config";

export const McpRegistrationStrategyKind = Object.freeze({
  /** Hand off to the vendor's own MCP install URI. The vendor's own app shows its own confirmation
   *  UI, owns the handler, and keeps working across the vendor's own config-format changes — this
   *  app never touches the agent's config file at all. */
  Deeplink: "deeplink",
  /** Render a copy-paste shell command for the user to run in their own terminal. The command runs
   *  in the user's real shell with their real PATH already loaded, and the agent's own CLI picks
   *  the correct config file and scope — this app never has to guess either. */
  ManualCommand: "manualCommand",
  /** Merges directly into the agent's JSON config file. The fallback where no better mechanism
   *  exists, or a declared secondary mechanism for a `Deeplink` agent (see
   *  `DeeplinkRegistrationStrategy.fallback`). */
  FileMerge: "fileMerge",
} as const);
export type McpRegistrationStrategyKind =
  (typeof McpRegistrationStrategyKind)[keyof typeof McpRegistrationStrategyKind];

/** Base directory a `FileMergeConfigPathSpec`'s `segments` are resolved relative to. Resolution
 *  itself happens only in `../main/agent-access-path-resolver.ts`; this stays a plain string
 *  discriminant so the spec is safe to import from the renderer. */
export interface FileMergeConfigPathSpec {
  /** `"home"` resolves to `os.homedir()`; `"appData"` resolves to Electron's
   *  `app.getPath("appData")` (`%APPDATA%` on Windows, `~/Library/Application Support` on macOS,
   *  `$XDG_CONFIG_HOME`/`~/.config` on Linux). Prefer `"appData"` for any config that lives under a
   *  vendor's per-OS application-data convention — hardcoding `"home"` + OS-specific segments (the
   *  old approach) breaks for a redirected `%APPDATA%` or a set `$XDG_CONFIG_HOME`. */
  base: "home" | "appData";
  segments: string[];
  /** Restricts this location to the given `process.platform` values; omit if the same relative
   *  path is correct on every platform. */
  platforms?: NodeJS.Platform[];
}

/**
 * Format of an agent's own config file, for the READ-ONLY status probe on `AgentDefinition
 * .readOnlyStatusConfig` (`models/agent-registry.ts`). Never used to write — the write path for
 * every agent is `Deeplink`, `ManualCommand`, or `FileMerge` above, never a direct read-modify-write
 * driven by this format.
 */
export const AgentStatusConfigFormat = Object.freeze({
  /** JSON config; look for an entry under a top-level servers key, e.g. Claude Code's
   *  `~/.claude.json` -> `mcpServers`. */
  Json: "json",
  /** TOML config; rather than adding a TOML parser dependency, the status check does a targeted
   *  text scan for a `[<table>.<name>]` section header. An inconclusive scan must resolve to
   *  "unknown", never a guessed "not registered" — see `AgentAccessRegistrationStatusService`. */
  TomlSection: "tomlSection",
} as const);
export type AgentStatusConfigFormat =
  (typeof AgentStatusConfigFormat)[keyof typeof AgentStatusConfigFormat];

export interface JsonAgentStatusConfig {
  format: typeof AgentStatusConfigFormat.Json;
  configPath: FileMergeConfigPathSpec;
  serversKey: "mcpServers" | "servers";
}

export interface TomlSectionAgentStatusConfig {
  format: typeof AgentStatusConfigFormat.TomlSection;
  configPath: FileMergeConfigPathSpec;
  /** TOML table name the server entry lives under, e.g. `"mcp_servers"` for Codex's
   *  `[mcp_servers.bitwarden]`. The full section header is built at read time from this table plus
   *  `BITWARDEN_MCP_SERVER_NAME`. */
  table: string;
}

/** READ-ONLY — never used to write. See `AgentDefinition.readOnlyStatusConfig` in
 *  `models/agent-registry.ts`. */
export type AgentReadOnlyStatusConfig = JsonAgentStatusConfig | TomlSectionAgentStatusConfig;

export interface FileMergeRegistrationStrategy {
  kind: typeof McpRegistrationStrategyKind.FileMerge;
  /** Candidate config file locations; the main process uses the first spec whose `platforms` (if
   *  any) includes `process.platform`. */
  configPaths: FileMergeConfigPathSpec[];
  /** Top-level key the server entry is merged under. Most MCP clients use `mcpServers`; VS Code
   *  (Copilot Chat) uses `servers`. */
  serversKey: "mcpServers" | "servers";
}

/** Which vendor-specific install-URI shape `buildInstallDeeplink` renders. Kept as a discriminant
 *  (not a raw URI template) so each vendor's exact, non-uniform encoding rules live in one place —
 *  see the VERIFIED doc citations on each case in `buildInstallDeeplink` below and on the
 *  `AgentDefinition` that uses it in `models/agent-registry.ts`. */
export const DeeplinkFormat = Object.freeze({
  /** Cursor's MCP install deeplink. */
  CursorInstall: "cursorInstall",
  /** VS Code's MCP install URI (used for the GitHub Copilot entry, which speaks MCP through the VS
   *  Code Copilot Chat extension). */
  VsCodeInstall: "vsCodeInstall",
} as const);
export type DeeplinkFormat = (typeof DeeplinkFormat)[keyof typeof DeeplinkFormat];

export interface DeeplinkRegistrationStrategy {
  kind: typeof McpRegistrationStrategyKind.Deeplink;
  format: DeeplinkFormat;
  /**
   * Fallback for an agent whose vendor app isn't installed/registered to handle the deeplink, or
   * whose install flow otherwise can't complete — e.g. Copilot's VS Code install URI requires VS
   * Code to already be running and registered as the `vscode:` URI handler, and gives no completion
   * signal either way: a failed `launchUri` fails silently, with no way for this app to tell success
   * from failure. Omit if there's no reasonable fallback (e.g. Cursor's deeplink is the only
   * mechanism offered for it).
   *
   * Actively consumed, not just declared data: `AgentAccessRegistrationService.registerWithAgent`
   * resolves and writes through this strategy automatically when called for an agent whose primary
   * strategy is `Deeplink` and who declares one — see that service's `resolveFileMergeStrategy` doc
   * comment. The *when* still stays a caller decision: the UI only reaches `registerWithAgent` for
   * this agent via an explicit secondary user action ("VS Code didn't open? Write the config
   * directly"), never as an automatic retry after `launchUri` — this app must never write to a
   * user's config file as a silent side effect of a deeplink it can't confirm failed.
   */
  fallback?: FileMergeRegistrationStrategy;
}

/** Which vendor CLI argv shape a `ManualCommand` strategy renders. Each style's exact syntax is
 *  independently VERIFIED against that vendor's own docs — see the doc citations in
 *  `buildManualSetupCommand` below and on the `AgentDefinition` that uses it in
 *  `models/agent-registry.ts`. */
export const ManualCommandStyle = Object.freeze({
  /** `claude mcp add [options] <name> -- <command> [args...]`. */
  ClaudeMcpAdd: "claudeMcpAdd",
  /** `codex mcp add <name> -- <command> [args...]` — no scope flag; Codex has a single global
   *  `~/.codex/config.toml`, not a project/user scope split. */
  CodexMcpAdd: "codexMcpAdd",
  /** `gemini mcp add [options] <name> <command> [args...]`. */
  GeminiMcpAdd: "geminiMcpAdd",
} as const);
export type ManualCommandStyle = (typeof ManualCommandStyle)[keyof typeof ManualCommandStyle];

export interface ManualCommandRegistrationStrategy {
  kind: typeof McpRegistrationStrategyKind.ManualCommand;
  style: ManualCommandStyle;
  /** Extra flags rendered right after the `mcp add` subcommand, before the server name — e.g.
   *  `["--scope", "user"]` for Claude Code so the pasted command targets the same user-global scope
   *  this app's status probe reads from (`AgentDefinition.readOnlyStatusConfig`). */
  extraOptions?: string[];
}

export type McpRegistrationStrategy =
  DeeplinkRegistrationStrategy | ManualCommandRegistrationStrategy | FileMergeRegistrationStrategy;

/** Always double-quotes its argument. `aacPath` is a filesystem path that may contain spaces (e.g.
 *  under "Program Files" or "Application Support"); double quotes are valid path quoting in bash,
 *  zsh, cmd.exe, and PowerShell alike, which is as much common ground as a copy-paste command can
 *  assume without knowing the user's actual shell. Server name / subcommand literals below never
 *  need this — they're fixed, space-free strings. */
function quotePathArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/**
 * Builds the exact copy-paste command for a `ManualCommand` agent to register the bundled `aac mcp`
 * server. Pure and renderer-safe — no IPC round trip needed; the renderer already has `aacPath` via
 * `ipc.agentAccess.getBundledCliPath()`.
 */
export function buildManualSetupCommand(
  strategy: ManualCommandRegistrationStrategy,
  aacPath: string,
): string {
  const options = strategy.extraOptions ?? [];
  const quotedPath = quotePathArg(aacPath);

  switch (strategy.style) {
    case ManualCommandStyle.ClaudeMcpAdd:
      // VERIFIED — https://code.claude.com/docs/en/mcp ("Basic syntax: claude mcp add [options]
      // <name> -- <command> [args...]"; the `--` is documented as required for stdio servers so
      // Claude doesn't try to parse the server's own args as its own options).
      return [
        "claude",
        "mcp",
        "add",
        ...options,
        BITWARDEN_MCP_SERVER_NAME,
        "--",
        quotedPath,
        "mcp",
      ].join(" ");
    case ManualCommandStyle.CodexMcpAdd:
      // VERIFIED — https://developers.openai.com/codex/extend/mcp ("codex mcp add <server-name>
      // ... -- <stdio server-command>"; no scope flag documented — Codex has one global
      // ~/.codex/config.toml).
      return ["codex", "mcp", "add", BITWARDEN_MCP_SERVER_NAME, "--", quotedPath, "mcp"].join(" ");
    case ManualCommandStyle.GeminiMcpAdd:
      // VERIFIED — https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md
      // ("gemini mcp add [options] <name> <command> [args...]"; `-s, --scope` accepts "user"
      // (writes ~/.gemini/settings.json) or the default "project"). No `--` needed here since
      // "mcp" (aac's only arg) doesn't start with `-`.
      return [
        "gemini",
        "mcp",
        "add",
        ...options,
        BITWARDEN_MCP_SERVER_NAME,
        quotedPath,
        "mcp",
      ].join(" ");
    default: {
      // Exhaustiveness check: a new ManualCommandStyle was added without a case here.
      const unreachable: never = strategy.style;
      throw new Error(`Unhandled manual command style: ${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * Builds the exact install URI for a `Deeplink` agent to register the bundled `aac mcp` server.
 * Pure and renderer-safe — the caller opens it via `PlatformUtilsService.launchUri`, no IPC round
 * trip needed.
 */
export function buildInstallDeeplink(
  strategy: DeeplinkRegistrationStrategy,
  aacPath: string,
): string {
  const entry = buildBitwardenMcpServerEntry(aacPath);

  switch (strategy.format) {
    case DeeplinkFormat.CursorInstall: {
      // VERIFIED — https://cursor.com/docs/context/mcp/install-links: "The link uses the cursor://
      // protocol scheme, anysphere.cursor-deeplink as the deeplink handler, /mcp/install as the
      // path, name as a query parameter for the server name, and config as a query parameter for
      // base64 encoded JSON configuration." Format:
      // cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_CONFIG
      const config = Utils.fromUtf8ToB64(JSON.stringify(entry));
      const params = new URLSearchParams({ name: BITWARDEN_MCP_SERVER_NAME, config });
      return `cursor://anysphere.cursor-deeplink/mcp/install?${params.toString()}`;
    }
    case DeeplinkFormat.VsCodeInstall: {
      // VERIFIED — https://code.visualstudio.com/api/extension-guides/ai/mcp: install URI is
      // `vscode:mcp/install?{json-configuration}`, built by "perform[ing] a JSON-stringify and URL
      // encode" on a config object that includes the server's own `name` field (unlike Cursor,
      // which passes `name` as a separate query param and base64-encodes only the server config).
      //
      // KNOWN LIMITATION — VS Code Insiders unsupported: the same doc also states the Insiders
      // build registers a *different* URI scheme, `vscode-insiders:mcp/install?{json-configuration}`
      // — VERIFIED, same page. This builder always emits `vscode:` (stable). A user who only has
      // Insiders installed gets a dead button: `launchUri` on an unregistered scheme fails silently,
      // with no completion signal for this app to detect and recover from. The `FileMerge` fallback
      // on `COPILOT_DEFINITION` (`models/agent-registry.ts`) doesn't rescue them either — it targets
      // `<appData>/Code/User/mcp.json`, which Insiders never reads; Insiders' own user directory is
      // `<appData>/Code - Insiders/User/mcp.json` (consistent "Code" -> "Code - Insiders" naming
      // used throughout VS Code's Insiders build, corroborated by e.g.
      // https://renenyffenegger.ch/notes/development/editors/Visual-Studio-Code/directories/user-data/index
      // — not itself confirmed on code.visualstudio.com, so not marked VERIFIED). Supporting this
      // properly needs a runtime "which VS Code variant is actually installed" signal feeding into
      // *both* the deeplink scheme and the fallback path — i.e. restructuring `AgentDefinition` away
      // from one static strategy per agent — which was judged not worth doing until this limitation
      // is confirmed to matter for real users; ship the honest gap instead of a half-working
      // variant selector.
      const payload: { name: string } & McpServerEntry = {
        name: BITWARDEN_MCP_SERVER_NAME,
        ...entry,
      };
      return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(payload))}`;
    }
    default: {
      // Exhaustiveness check: a new DeeplinkFormat was added without a case here.
      const unreachable: never = strategy.format;
      throw new Error(`Unhandled deeplink format: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Outcome of registering the Bitwarden MCP server with a given agent. Generalizes the legacy M2
 *  Claude-Code-only onboarding outcome shape across every supported agent and both registration
 *  strategies. */
export const RegisterWithAgentStatus = Object.freeze({
  /** No Bitwarden entry existed for this agent; one was added. */
  Added: "added",
  /** A Bitwarden entry existed with different values; it was overwritten (file-merge only). */
  Updated: "updated",
  /** A Bitwarden entry already matched exactly; nothing was changed (file-merge only). */
  AlreadyPresent: "alreadyPresent",
  /** The bundled CLI path was unavailable, the agent's config couldn't be reached/parsed, or the
   *  requested agent isn't registered by writing a file from this app at all (see
   *  `AgentAccessRegistrationService.registerWithAgent`'s doc comment). Nothing is ever written in
   *  this case. */
  Error: "error",
} as const);
export type RegisterWithAgentStatus =
  (typeof RegisterWithAgentStatus)[keyof typeof RegisterWithAgentStatus];

export interface RegisterWithAgentResult {
  status: RegisterWithAgentStatus;
  /** Free-form, human-readable, never file contents — surfaced in a toast/callout only. */
  message?: string;
}
