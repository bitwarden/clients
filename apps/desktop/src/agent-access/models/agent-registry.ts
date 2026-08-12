/**
 * Declarative registry of every AI coding agent Agent Access supports (agent-access-architecture
 * .md, "M3 — multi-agent support"). Renderer-safe (no Node imports) so the UI can list agents,
 * show display names, and describe how each was detected/registered without importing across the
 * main/renderer boundary — see `apps/desktop/CLAUDE.md`. `AgentDetectionService`,
 * `AgentAccessRegistrationService`, and `AgentAccessRegistrationStatusService` in `../main/` are
 * what actually interpret this data against the real filesystem.
 *
 * Every mechanism below is labeled VERIFIED (with the doc URL and what it confirmed) or UNVERIFIED
 * at the time it was written. An UNVERIFIED mechanism is never shipped as an agent's primary
 * registration strategy — see each entry for how it's handled instead. This distinction is the
 * direct fix for the bug that motivated this rewrite: the previous registry shipped an UNVERIFIED
 * `-s`/`--scope` flag guess as executable code (`registerViaCli`, since deleted), and separately
 * spawned agent CLIs by bare name against `process.env.PATH`, which is empty (launchd's default)
 * for an app launched normally on macOS — see `models/agent-registration.ts`'s doc comment for the
 * full story.
 */
import {
  AgentDetectionProbe,
  AgentDetectionProbeKind,
  AgentPathProbeBase,
} from "./agent-detection";
import { AgentId } from "./agent-id";
import {
  AgentReadOnlyStatusConfig,
  AgentStatusConfigFormat,
  DeeplinkFormat,
  ManualCommandStyle,
  McpRegistrationStrategy,
  McpRegistrationStrategyKind,
} from "./agent-registration";

export interface AgentDefinition {
  id: AgentId;
  displayName: string;
  detectionProbes: AgentDetectionProbe[];
  registrationStrategy: McpRegistrationStrategy;
  /**
   * READ-ONLY — describes where/how to find this agent's own config file so a status query can
   * tell whether Bitwarden is already registered, by reading whatever the agent's own CLI/app
   * wrote. Used ONLY by `AgentAccessRegistrationStatusService.getAgentRegistrationStatuses()`;
   * never used to write, for any strategy kind — that's the whole point of it living independently
   * of `registrationStrategy` rather than nested under `FileMergeRegistrationStrategy` the way it
   * used to be nested under the deleted `CliRegistrationStrategy`. A `ManualCommand`/`Deeplink`
   * agent has no write path this app controls at all, so this status probe is the *only* way to
   * close the loop and show "Connected" after the user runs the command / completes the vendor's
   * install flow. Omit if no reliable read-only status check exists; status then resolves to
   * `AgentRegistrationStatus.Unknown` rather than a guess.
   */
  readOnlyStatusConfig?: AgentReadOnlyStatusConfig;
}

const CLAUDE_DEFINITION: AgentDefinition = {
  id: AgentId.Claude,
  displayName: "Claude Code",
  detectionProbes: [
    {
      kind: AgentDetectionProbeKind.Executable,
      description: "claude on PATH",
      executable: "claude",
    },
    {
      kind: AgentDetectionProbeKind.Path,
      description: "~/.claude.json",
      base: AgentPathProbeBase.Home,
      segments: [".claude.json"],
    },
    {
      kind: AgentDetectionProbeKind.Path,
      description: "~/.claude/",
      base: AgentPathProbeBase.Home,
      segments: [".claude"],
    },
  ],
  // ManualCommand: the user runs this themselves, in their own shell with their own PATH — see
  // models/agent-registration.ts's doc comment for why this app no longer spawns `claude` itself.
  // VERIFIED against https://code.claude.com/docs/en/mcp:
  //  - Command shape `claude mcp add [options] <name> -- <command> [args...]`, `--` required for
  //    stdio servers (doc: "the -- (double dash) separates Claude's own options ... from the
  //    command and arguments that run the server").
  //  - `--scope user` writes to the TOP LEVEL of `~/.claude.json` under `mcpServers` (doc: "If you
  //    open a local session ... with the same stdio server name at the top level of
  //    `~/.claude.json` (user scope)"), distinct from the default `local` scope, which nests under
  //    `projects.<cwd>.mcpServers` instead — `--scope user` is used here specifically so the result
  //    is available from any project, matching the legacy single-agent onboarding behavior.
  registrationStrategy: {
    kind: McpRegistrationStrategyKind.ManualCommand,
    style: ManualCommandStyle.ClaudeMcpAdd,
    extraOptions: ["--scope", "user"],
  },
  // Status-only (never written to): matches the `--scope user` target above.
  readOnlyStatusConfig: {
    format: AgentStatusConfigFormat.Json,
    configPath: { base: "home", segments: [".claude.json"] },
    serversKey: "mcpServers",
  },
};

const CODEX_DEFINITION: AgentDefinition = {
  id: AgentId.Codex,
  displayName: "Codex CLI",
  detectionProbes: [
    { kind: AgentDetectionProbeKind.Executable, description: "codex on PATH", executable: "codex" },
    {
      kind: AgentDetectionProbeKind.Path,
      description: "~/.codex/config.toml",
      base: AgentPathProbeBase.Home,
      segments: [".codex", "config.toml"],
    },
  ],
  // ManualCommand — see the Claude entry above for why. VERIFIED against
  // https://developers.openai.com/codex/extend/mcp: `codex mcp add <server-name> ...
  // -- <stdio server-command>`, written to `~/.codex/config.toml` under `[mcp_servers.<name>]`.
  // No scope flag is documented — Codex has a single global config, not a project/user split — so
  // no `extraOptions` are added.
  registrationStrategy: {
    kind: McpRegistrationStrategyKind.ManualCommand,
    style: ManualCommandStyle.CodexMcpAdd,
  },
  // Status-only (never written to): TOML — scanned by targeted text search rather than a full
  // parser, see AgentAccessRegistrationStatusService.
  readOnlyStatusConfig: {
    format: AgentStatusConfigFormat.TomlSection,
    configPath: { base: "home", segments: [".codex", "config.toml"] },
    table: "mcp_servers",
  },
};

const CURSOR_DEFINITION: AgentDefinition = {
  id: AgentId.Cursor,
  displayName: "Cursor",
  detectionProbes: [
    {
      kind: AgentDetectionProbeKind.Path,
      description: "~/.cursor/",
      base: AgentPathProbeBase.Home,
      segments: [".cursor"],
    },
    {
      kind: AgentDetectionProbeKind.AppBundle,
      description: "Cursor.app",
      macAppName: "Cursor.app",
    },
  ],
  // Deeplink — Cursor's own app owns the install confirmation UI. VERIFIED against
  // https://cursor.com/docs/context/mcp/install-links: format is
  // `cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_CONFIG` (see
  // `buildInstallDeeplink` in models/agent-registration.ts for the exact builder). No fallback
  // declared: unlike Copilot's VS Code install URI, there's no evidence Cursor's deeplink depends
  // on the app already running, so a FileMerge fallback isn't clearly justified here.
  registrationStrategy: {
    kind: McpRegistrationStrategyKind.Deeplink,
    format: DeeplinkFormat.CursorInstall,
  },
  // Status-only (never written to). VERIFIED path/key against https://cursor.com/docs/context/mcp
  // ("Create ~/.cursor/mcp.json in your home directory for tools available everywhere" +
  // `mcpServers`-keyed examples).
  readOnlyStatusConfig: {
    format: AgentStatusConfigFormat.Json,
    configPath: { base: "home", segments: [".cursor", "mcp.json"] },
    serversKey: "mcpServers",
  },
};

const GEMINI_DEFINITION: AgentDefinition = {
  id: AgentId.Gemini,
  displayName: "Gemini CLI",
  detectionProbes: [
    // UNVERIFIED: no independent confirmation the `gemini` binary is on PATH under this exact
    // name; kept as a probe (presence-only, never executed — see agent-detection.service.ts) since
    // a false-negative here only costs a missed "Detected" badge, not a wrong registration.
    {
      kind: AgentDetectionProbeKind.Executable,
      description: "gemini on PATH",
      executable: "gemini",
    },
    {
      kind: AgentDetectionProbeKind.Path,
      description: "~/.gemini/",
      base: AgentPathProbeBase.Home,
      segments: [".gemini"],
    },
  ],
  // ManualCommand — see the Claude entry above for why. VERIFIED against
  // https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md: basic syntax
  // `gemini mcp add [options] <name> <command> [args...]`; `-s, --scope` accepts `"user"` (writes
  // `~/.gemini/settings.json`) vs. the default `"project"` (writes `.gemini/settings.json`) —
  // `--scope user` is used here for the same cross-project reason as Claude Code's `--scope user`.
  registrationStrategy: {
    kind: McpRegistrationStrategyKind.ManualCommand,
    style: ManualCommandStyle.GeminiMcpAdd,
    extraOptions: ["--scope", "user"],
  },
  // Status-only (never written to): matches the `--scope user` target above.
  readOnlyStatusConfig: {
    format: AgentStatusConfigFormat.Json,
    configPath: { base: "home", segments: [".gemini", "settings.json"] },
    serversKey: "mcpServers",
  },
};

const COPILOT_DEFINITION: AgentDefinition = {
  id: AgentId.Copilot,
  displayName: "GitHub Copilot",
  detectionProbes: [
    {
      kind: AgentDetectionProbeKind.Path,
      description: "~/.copilot/",
      base: AgentPathProbeBase.Home,
      segments: [".copilot"],
    },
    // Base directory VERIFIED against https://code.visualstudio.com/docs/configure/settings (user
    // settings.json — and by extension every file in the same "Code/User" profile directory —
    // lives at `%APPDATA%\Code\User` / `~/Library/Application Support/Code/User` /
    // `~/.config/Code/User`, i.e. exactly `<appData>/Code/User` on all three platforms). Using
    // `base: "appData"` collapses what used to be three separately-guessed, platform-hardcoded
    // probes (one of which duplicated the exact `AppData\Roaming`/`.config` guesses that made this
    // registry's Windows/Linux Copilot config path wrong for a redirected `%APPDATA%` or a set
    // `$XDG_CONFIG_HOME`) down to the one genuinely platform-specific difference left: the `.exe`
    // suffix on the binary name. The rest of this specific path — `globalStorage/github.copilot-
    // chat/copilotCli/copilot` — is an implementation detail of the Copilot Chat VS Code extension,
    // UNVERIFIED against any doc; kept only as a presence-only detection probe (never executed), so
    // a wrong guess here costs a missed "Detected" badge, never a bad registration.
    {
      kind: AgentDetectionProbeKind.Path,
      description: "<appData>/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot",
      base: AgentPathProbeBase.AppData,
      segments: ["Code", "User", "globalStorage", "github.copilot-chat", "copilotCli", "copilot"],
      platforms: ["darwin", "linux"],
    },
    {
      kind: AgentDetectionProbeKind.Path,
      description: "<appData>/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot.exe",
      base: AgentPathProbeBase.AppData,
      segments: [
        "Code",
        "User",
        "globalStorage",
        "github.copilot-chat",
        "copilotCli",
        "copilot.exe",
      ],
      platforms: ["win32"],
    },
  ],
  // Deeplink, with FileMerge retained as a fallback `registerWithAgent` writes through on an
  // explicit secondary user action (see `DeeplinkRegistrationStrategy.fallback`'s doc comment — the
  // deeplink gives no completion signal, so this is the user's only recourse if it silently fails).
  // VS Code's install URI needs VS Code itself to already be running and registered as the
  // `vscode:` handler, which is a materially less certain precondition than Cursor's own
  // `cursor://` handler, so a fallback is worth declaring here specifically.
  //  - Deeplink format VERIFIED against
  //    https://code.visualstudio.com/api/extension-guides/ai/mcp: `vscode:mcp/install?
  //    {json-configuration}`, built by JSON-stringifying `{ name, ...serverConfig }` and
  //    URL-encoding the result (see `buildInstallDeeplink`).
  //  - Fallback config path base VERIFIED as above (`<appData>/Code/User`); the `mcp.json` filename
  //    and the `servers` top-level key VERIFIED against
  //    https://code.visualstudio.com/docs/agent-customization/mcp-servers (user config opened via
  //    "MCP: Open User Configuration" is `mcp.json` in the user profile folder; example config
  //    shown uses a top-level `"servers"` object). This collapses what used to be three
  //    per-platform specs (one marked "the highest-risk config path in this registry") into one.
  //
  // KNOWN LIMITATION — VS Code Insiders unsupported (both here and in `buildInstallDeeplink`'s
  // `VsCodeInstall` case, `models/agent-registration.ts`, which has the full writeup): both
  // `format: DeeplinkFormat.VsCodeInstall` above and the `fallback.configPaths` below assume
  // stable VS Code (`vscode:` scheme, `<appData>/Code/User/mcp.json`) — a user with only VS Code
  // Insiders installed gets neither a working deeplink (Insiders needs `vscode-insiders:`, VERIFIED
  // same doc as the stable scheme) nor a working fallback (Insiders reads
  // `<appData>/Code - Insiders/User/mcp.json`, a different file this fallback never touches).
  // Deliberately not fixed here: doing so needs a runtime "which variant is installed" signal
  // driving *both* fields, which means restructuring this definition away from one static
  // `registrationStrategy` per agent — a bigger change than shipping a documented gap.
  registrationStrategy: {
    kind: McpRegistrationStrategyKind.Deeplink,
    format: DeeplinkFormat.VsCodeInstall,
    fallback: {
      kind: McpRegistrationStrategyKind.FileMerge,
      configPaths: [{ base: "appData", segments: ["Code", "User", "mcp.json"] }],
      serversKey: "servers",
    },
  },
  // Status-only (never written to), same path/key as the fallback above.
  readOnlyStatusConfig: {
    format: AgentStatusConfigFormat.Json,
    configPath: { base: "appData", segments: ["Code", "User", "mcp.json"] },
    serversKey: "servers",
  },
};

export const SUPPORTED_AGENTS: AgentDefinition[] = [
  CLAUDE_DEFINITION,
  CODEX_DEFINITION,
  CURSOR_DEFINITION,
  GEMINI_DEFINITION,
  COPILOT_DEFINITION,
];

export const AGENT_DEFINITIONS: Record<AgentId, AgentDefinition> = {
  [AgentId.Claude]: CLAUDE_DEFINITION,
  [AgentId.Codex]: CODEX_DEFINITION,
  [AgentId.Cursor]: CURSOR_DEFINITION,
  [AgentId.Gemini]: GEMINI_DEFINITION,
  [AgentId.Copilot]: COPILOT_DEFINITION,
};
