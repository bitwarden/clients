/**
 * Shared contract between the main-process SSH agent setup service and the renderer UI.
 * The renderer never supplies paths, file contents or commands. It only asks for a plan and then
 * applies or undoes steps by id; the main process owns every path and every byte written.
 */

export const SshAgentSetupPlatform = Object.freeze({
  Mac: "mac",
  Linux: "linux",
  Windows: "windows",
} as const);
export type SshAgentSetupPlatform =
  (typeof SshAgentSetupPlatform)[keyof typeof SshAgentSetupPlatform];

export const SshAgentSetupPackaging = Object.freeze({
  Standard: "standard",
  MacAppStore: "mas",
  Snap: "snap",
  Flatpak: "flatpak",
  WindowsStore: "windowsStore",
} as const);
export type SshAgentSetupPackaging =
  (typeof SshAgentSetupPackaging)[keyof typeof SshAgentSetupPackaging];

/** How the user gets set up on this device. */
export const SshAgentSetupMode = Object.freeze({
  /** The app can write the configuration after the user reviews and approves it. */
  Automatic: "automatic",
  /** The app cannot (or must not) write; show copy-ready steps instead. */
  Guided: "guided",
} as const);
export type SshAgentSetupMode = (typeof SshAgentSetupMode)[keyof typeof SshAgentSetupMode];

export const SshAgentSetupStepKind = Object.freeze({
  /** Adds one marked `Include` line to ~/.ssh/config that points to an app-owned file. */
  SshConfigInclude: "ssh-config-include",
  /** Adds one marked block to a shell profile that exports SSH_AUTH_SOCK. */
  ShellProfile: "shell-profile",
} as const);
export type SshAgentSetupStepKind =
  (typeof SshAgentSetupStepKind)[keyof typeof SshAgentSetupStepKind];

export const SshAgentSetupStepStatus = Object.freeze({
  Pending: "pending",
  AlreadyConfigured: "already-configured",
  /** Another agent or value is already configured. Default is to leave it untouched. */
  Conflict: "conflict",
  /** Refused for safety (symlink, wrong owner, group/world writable, unsafe path characters). */
  Blocked: "blocked",
  Applied: "applied",
  Failed: "failed",
} as const);
export type SshAgentSetupStepStatus =
  (typeof SshAgentSetupStepStatus)[keyof typeof SshAgentSetupStepStatus];

export const SshAgentSetupOverallStatus = Object.freeze({
  NotConfigured: "not-configured",
  Configured: "configured",
  Partial: "partial",
  Conflict: "conflict",
  Unsupported: "unsupported",
} as const);
export type SshAgentSetupOverallStatus =
  (typeof SshAgentSetupOverallStatus)[keyof typeof SshAgentSetupOverallStatus];

export interface SshAgentSetupEnvironment {
  platform: SshAgentSetupPlatform;
  packaging: SshAgentSetupPackaging;
  mode: SshAgentSetupMode;
  /** Why the flow is guided only, as an i18n key. Present when mode is Guided. */
  guidedReasonKey?: string;
  /** The address the agent actually bound: a Unix socket path, or the Windows pipe name. */
  socketAddress: string | null;
  /** The address the agent binds when it runs, known even after a failed start. */
  intendedSocketAddress: string | null;
  /** The user's SSH agent setting. Separates "switched off" from "failed to start". */
  agentEnabled: boolean;
  /** True when the agent server is listening on socketAddress. */
  agentRunning: boolean;
  /** Short error class (never a path or key material) when the agent failed to start. */
  startErrorCode?: "address-in-use" | "permission-denied" | "unknown";
  /** Other agents detected on this device, by display name only. */
  otherAgents: string[];
}

export interface SshAgentSetupStep {
  id: string;
  kind: SshAgentSetupStepKind;
  status: SshAgentSetupStepStatus;
  /** Home-relative path for display only, for example `~/.ssh/config`. */
  displayPath: string;
  /** Exact lines that will be added, for the preview. Empty when nothing would change. */
  addedLines: string[];
  /** For conflicts: the existing line and where it is, for display only. */
  conflict?: { existingLine: string; lineNumber: number };
  /** For blocked steps: i18n key explaining why. */
  blockedReasonKey?: string;
}

export interface SshAgentSetupPlan {
  /** Bound to a main-process held plan and the hashes of the files it was computed from. */
  planId: string;
  steps: SshAgentSetupStep[];
  /** Windows and other guided platforms: literal command the user copies and runs themselves. */
  guidedCommands: { id: string; command: string; descriptionKey: string }[];
}

export type SshAgentSetupWriteErrorClass = "read-only" | "no-space" | "permission" | "other";

export interface SshAgentSetupApplyResult {
  stepId: string;
  status: SshAgentSetupStepStatus;
  /** Error class only, never a path or file content. `plan-expired`: the held plan is gone. */
  errorCode?: "changed-since-preview" | "write-failed" | "blocked" | "plan-expired" | "unknown";
  /** Home-relative path for display only, for example `~/.ssh/config`. */
  displayPath?: string;
  /** For blocked results: i18n key explaining why. */
  blockedReasonKey?: string;
  /** For write failures: a coarse class of the error. Never a message or path. */
  writeErrorClass?: SshAgentSetupWriteErrorClass;
}

export const SshAgentVerifyOutcome = Object.freeze({
  Ok: "ok",
  /** Cannot connect to the Bitwarden agent address, or the agent is on but not answering. */
  Unreachable: "unreachable",
  /** SSH clients in a new terminal would reach a different agent. */
  OtherAgent: "other-agent",
  /** Bitwarden is not connected to new terminals or ssh yet. Nothing else overrides it. */
  NotConfigured: "not-configured",
  /** Connected, but the vault is locked or has no SSH keys to list yet. */
  NoKeys: "no-keys",
  /** Not checked: unsupported here, could not run, or (for the agent) switched off. */
  NotChecked: "not-checked",
} as const);
export type SshAgentVerifyOutcome =
  (typeof SshAgentVerifyOutcome)[keyof typeof SshAgentVerifyOutcome];

export interface SshAgentVerifyResult {
  /** Can we connect to the agent address directly? */
  agent: SshAgentVerifyOutcome;
  /** What `ssh -G` would use for IdentityAgent. */
  sshClient: SshAgentVerifyOutcome;
  /** What a new terminal sees via SSH_AUTH_SOCK (used by ssh-add and git SSH signing). */
  shell: SshAgentVerifyOutcome;
  /** Display-only facts that explain a non-ok outcome. Paths use `~` for the home directory. */
  details?: SshAgentVerifyDetails;
}

export interface SshAgentVerifyDetails {
  /** The IdentityAgent value ssh would use when it is not Bitwarden's. */
  identityAgent?: string;
  /** File whose SSH_AUTH_SOCK assignment overrides the Bitwarden block. */
  overrideFile?: string;
  /** 1-based line of that assignment in `overrideFile`. */
  overrideLine?: number;
  /** The Bitwarden agent address. */
  socketAddress?: string;
}

/** Exposed to the renderer as `ipc.autofill.sshAgent.setup`. */
export interface SshAgentSetupApi {
  getEnvironment(): Promise<SshAgentSetupEnvironment>;
  getStatus(): Promise<SshAgentSetupOverallStatus>;
  getPlan(): Promise<SshAgentSetupPlan>;
  apply(planId: string, stepIds: string[]): Promise<SshAgentSetupApplyResult[]>;
  /** Removes exactly the marked blocks and files this feature added. */
  undo(): Promise<SshAgentSetupApplyResult[]>;
  verify(): Promise<SshAgentVerifyResult>;
}
