/**
 * Declarative detection probes for AI coding agent clients (agent-access-architecture.md, "M3 —
 * multi-agent support"). Renderer-safe (no Node imports): probes are plain data describing *what*
 * to check, not *how* — `AgentDetectionService` in `../main/` is the only place that touches `fs`
 * or spawns a process to actually run them. This split lets the renderer show the same probe
 * definitions (e.g. "which signal matched") without ever importing Node modules.
 */
import { AgentId } from "./agent-id";

/** Kind of check a single detection probe performs. */
export const AgentDetectionProbeKind = Object.freeze({
  /** Is `executable` resolvable on PATH? */
  Executable: "executable",
  /** Does a file or directory exist relative to `base`? */
  Path: "path",
  /** Does a macOS `.app` bundle exist under `/Applications`? */
  AppBundle: "appBundle",
} as const);
export type AgentDetectionProbeKind =
  (typeof AgentDetectionProbeKind)[keyof typeof AgentDetectionProbeKind];

/** Base directory an `AgentPathProbe`'s `segments` are resolved relative to. Both bases are plain
 *  string discriminants — resolving `AppData` still requires Electron's `app.getPath("appData")`,
 *  but that resolution happens only in `../main/agent-access-path-resolver.ts`, never here, so this
 *  file stays importable from the renderer. */
export const AgentPathProbeBase = Object.freeze({
  /** The user's home directory (`os.homedir()`). */
  Home: "home",
  /** Electron's `app.getPath("appData")` — `%APPDATA%` on Windows, `~/Library/Application Support`
   *  on macOS, `$XDG_CONFIG_HOME` (or `~/.config`) on Linux. Use this instead of hardcoding those
   *  three paths under `Home`: a redirected `%APPDATA%` or a set `$XDG_CONFIG_HOME` makes the
   *  hardcoded guess wrong, which is exactly how this registry's old Windows/Linux Copilot probes
   *  went stale. */
  AppData: "appData",
} as const);
export type AgentPathProbeBase = (typeof AgentPathProbeBase)[keyof typeof AgentPathProbeBase];

export interface AgentExecutableProbe {
  kind: typeof AgentDetectionProbeKind.Executable;
  /** Human-readable label surfaced in detection results, e.g. "claude on PATH". */
  description: string;
  /** Executable name to resolve on PATH, without a platform extension — the main process tries
   *  Windows candidates (`.cmd`/`.exe`/`.bat`) itself since a shell-less spawn doesn't apply
   *  PATHEXT the way a shell would. */
  executable: string;
}

export interface AgentPathProbe {
  kind: typeof AgentDetectionProbeKind.Path;
  description: string;
  base: AgentPathProbeBase;
  /** Path segments joined onto `base`, e.g. `[".claude.json"]` or `["AppData", "Roaming", ...]`. */
  segments: string[];
  /** Restricts this probe to the given `process.platform` values; omit to run on every platform. */
  platforms?: NodeJS.Platform[];
}

export interface AgentAppBundleProbe {
  kind: typeof AgentDetectionProbeKind.AppBundle;
  description: string;
  /** Bundle name under `/Applications`, e.g. `"Cursor.app"`. Only ever checked on macOS. */
  macAppName: string;
}

export type AgentDetectionProbe = AgentExecutableProbe | AgentPathProbe | AgentAppBundleProbe;

export interface AgentDetectionProbeResult {
  probe: AgentDetectionProbe;
  matched: boolean;
}

/** Detection outcome for a single agent — `detected` is true iff at least one probe matched. */
export interface AgentDetectionResult {
  agentId: AgentId;
  detected: boolean;
  probeResults: AgentDetectionProbeResult[];
}
