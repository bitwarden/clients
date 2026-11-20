import { randomUUID } from "crypto";
import * as os from "os";
import * as path from "path";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/logging";

import { SSH_AGENT_SETUP_IPC_CHANNELS } from "../models/ipc-channels";
import {
  SshAgentSetupApi,
  SshAgentSetupApplyResult,
  SshAgentSetupEnvironment,
  SshAgentSetupMode,
  SshAgentSetupOverallStatus,
  SshAgentSetupPackaging,
  SshAgentSetupPlan,
  SshAgentSetupPlatform,
  SshAgentSetupStep,
  SshAgentSetupStepKind,
  SshAgentSetupStepStatus,
  SshAgentSetupWriteErrorClass,
  SshAgentVerifyDetails,
  SshAgentVerifyOutcome,
  SshAgentVerifyResult,
} from "../models/ssh-agent-setup";

import { SshAgentNativeBridge, SshAgentStartErrorCode } from "./ssh-agent-native";
import {
  decideMode,
  detectLoginShell,
  detectOtherAgents,
  detectPackaging,
  detectPlatform,
  isSystemDefaultAuthSock,
  resolveSetupHome,
  SshSetupShell,
} from "./ssh-agent-setup-environment";
import {
  atomicWriteFile,
  checkPathSafety,
  createBackup,
  displayPath,
  ensureDirectory,
  errorClass,
  ExistingFile,
  PathSafetyContext,
  readExistingFile,
  removeDirectoryIfEmpty,
  removeFile,
  sha256,
  SshAgentSetupBlockedError,
  SshAgentSetupBlockedReason,
} from "./ssh-agent-setup-fs";
import {
  agentConfContent,
  expandHome,
  findIdentityAgentLines,
  findManagedBlocks,
  findSshAuthSockAssignments,
  fishDropInContent,
  FoundLine,
  guidedFishExportCommand,
  guidedPosixExportCommand,
  isIntactSshConfigBlock,
  isSafeSocketPath,
  ManagedBlockRange,
  parseAgentConfSocket,
  parseFishDropInSocket,
  parsePosixBlockSocket,
  posixShellBlockLines,
  removeRanges,
  sanitizeDisplayLine,
  splitLines,
  SSH_CONFIG_INCLUDE_TARGET,
  sshConfigBlockLines,
  WINDOWS_DISABLE_OPENSSH_AGENT_COMMAND,
} from "./ssh-agent-setup-templates";
import {
  defaultExecFile,
  ExecFileFn,
  readSshClientIdentityAgent,
  SSH_BINARY_ALLOWLIST,
  WINDOWS_DEFAULT_AGENT_PIPE,
} from "./ssh-agent-setup-verify";

export const SshAgentSetupStepId = Object.freeze({
  SshConfig: "ssh-config",
  ShellZsh: "shell-zsh",
  ShellBash: "shell-bash",
  ShellFish: "shell-fish",
} as const);
export type SshAgentSetupStepId = (typeof SshAgentSetupStepId)[keyof typeof SshAgentSetupStepId];

const SHELL_STEP_IDS: Readonly<Record<SshSetupShell, SshAgentSetupStepId>> = Object.freeze({
  zsh: SshAgentSetupStepId.ShellZsh,
  bash: SshAgentSetupStepId.ShellBash,
  fish: SshAgentSetupStepId.ShellFish,
});

const MAX_STEP_IDS = 10;
const MAX_ID_LENGTH = 64;
const LOG_PREFIX = "[SSH agent setup]";

/** Read-only view of the running agent owned by MainSshAgentService. */
export interface SshAgentSetupAgentState {
  isRunning(): boolean;
  /** True when the user's SSH agent setting is on, even if the agent failed to start. */
  isEnabled(): boolean;
  startErrorCode(): SshAgentStartErrorCode | undefined;
}

export interface SshAgentSetupDeps {
  platform: SshAgentSetupPlatform | null;
  packaging: SshAgentSetupPackaging;
  /** Every read and write happens below this directory. */
  home: string;
  homeOverridden: boolean;
  /** Current uid, or null on Windows. */
  uid: number | null;
  loginShell: SshSetupShell | null;
  /** Snapshot of the few environment variables the planner reads. */
  env: { SSH_AUTH_SOCK?: string; ZDOTDIR?: string; XDG_CONFIG_HOME?: string };
  runtimeDir: string | null;
  hostname: string;
  native: SshAgentNativeBridge;
  agentState: SshAgentSetupAgentState;
  execFile: ExecFileFn;
  sshBinaries: readonly string[];
  now: () => Date;
  logService: Pick<LogService, "info" | "warning">;
}

export function createDefaultSshAgentSetupDeps(
  native: SshAgentNativeBridge,
  agentState: SshAgentSetupAgentState,
  logService: Pick<LogService, "info" | "warning">,
): SshAgentSetupDeps {
  const windows = process.platform === "win32";
  let passwd: os.UserInfo<string> | null = null;
  try {
    passwd = os.userInfo();
  } catch {
    passwd = null;
  }
  // ssh resolves `~` from the passwd entry, not $HOME, so prefer the passwd home on Unix.
  const passwdHome = !windows && passwd?.homedir ? passwd.homedir : os.homedir();
  const { home, overridden } = resolveSetupHome(passwdHome);
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  return {
    platform: detectPlatform(process.platform),
    packaging: detectPackaging(),
    home,
    homeOverridden: overridden,
    uid,
    loginShell: detectLoginShell(windows ? null : passwd?.shell, process.env.SHELL),
    env: {
      SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
      // Dev/test overrides must never be redirected back into the real home.
      ZDOTDIR: overridden ? undefined : process.env.ZDOTDIR,
      XDG_CONFIG_HOME: overridden ? undefined : process.env.XDG_CONFIG_HOME,
    },
    runtimeDir: process.platform === "linux" && uid != null ? `/run/user/${uid}` : null,
    hostname: os.hostname(),
    native,
    agentState,
    execFile: defaultExecFile,
    sshBinaries: windows ? SSH_BINARY_ALLOWLIST.windows : SSH_BINARY_ALLOWLIST.unix,
    now: () => new Date(),
    logService,
  };
}

interface FileTarget {
  path: string;
  /** SHA-256 of the file at preview time, or "absent". */
  hash: string;
}

interface FileWrite {
  path: string;
  content: string;
  mode: number;
  /** User-owned files get a backup before they are modified. */
  userOwned: boolean;
}

interface HeldStep {
  step: SshAgentSetupStep;
  targets: FileTarget[];
  dirs: string[];
  writes: FileWrite[];
}

interface HeldPlan {
  planId: string;
  steps: Map<string, HeldStep>;
}

interface PlanningContext {
  home: string;
  socket: string | null;
  safety: PathSafetyContext;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Main-process implementation of the SSH agent setup flow. The renderer only ever passes a
 * planId and step ids; every path, every byte and every argv is decided here.
 */
export class SshAgentSetupService implements SshAgentSetupApi {
  private heldPlan: HeldPlan | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: SshAgentSetupDeps) {}

  async getEnvironment(): Promise<SshAgentSetupEnvironment> {
    const { mode, guidedReasonKey } = decideMode(this.deps.platform, this.deps.packaging);
    const startErrorCode = this.deps.agentState.startErrorCode();
    const running = this.deps.agentState.isRunning();
    const intended = this.deps.native.getSocketAddress();
    return {
      platform: this.deps.platform ?? SshAgentSetupPlatform.Linux,
      packaging: this.deps.packaging,
      mode,
      ...(guidedReasonKey != null ? { guidedReasonKey } : {}),
      socketAddress: running ? intended : null,
      intendedSocketAddress: intended,
      agentEnabled: this.deps.agentState.isEnabled(),
      agentRunning: running,
      ...(startErrorCode != null ? { startErrorCode } : {}),
      otherAgents: await detectOtherAgents({
        home: this.deps.home,
        runtimeDir: this.deps.runtimeDir,
        hostname: this.deps.hostname,
      }),
    };
  }

  async getStatus(): Promise<SshAgentSetupOverallStatus> {
    if (this.mode() !== SshAgentSetupMode.Automatic) {
      return SshAgentSetupOverallStatus.Unsupported;
    }
    const steps = (await this.computeSteps()).map((s) => s.step.status);
    if (steps.length === 0) {
      return SshAgentSetupOverallStatus.Unsupported;
    }
    const configured = steps.filter((s) => s === SshAgentSetupStepStatus.AlreadyConfigured).length;
    if (configured === steps.length) {
      return SshAgentSetupOverallStatus.Configured;
    }
    if (configured > 0) {
      return SshAgentSetupOverallStatus.Partial;
    }
    if (steps.includes(SshAgentSetupStepStatus.Conflict)) {
      return SshAgentSetupOverallStatus.Conflict;
    }
    return SshAgentSetupOverallStatus.NotConfigured;
  }

  getPlan(): Promise<SshAgentSetupPlan> {
    return this.serialize(async () => {
      const held = this.mode() === SshAgentSetupMode.Automatic ? await this.computeSteps() : [];
      const planId = randomUUID();
      this.heldPlan = { planId, steps: new Map(held.map((h) => [h.step.id, h])) };
      this.deps.logService.info(
        `${LOG_PREFIX} plan ${held.map((h) => `${h.step.id}=${h.step.status}`).join(" ")}`,
      );
      return {
        planId,
        steps: held.map((h) => ({ ...h.step })),
        guidedCommands: this.guidedCommands(held),
      };
    });
  }

  apply(planId: unknown, stepIds: unknown): Promise<SshAgentSetupApplyResult[]> {
    if (
      typeof planId !== "string" ||
      planId.length > MAX_ID_LENGTH ||
      !isStringArray(stepIds) ||
      stepIds.length > MAX_STEP_IDS ||
      stepIds.some((id) => id.length > MAX_ID_LENGTH)
    ) {
      return Promise.reject(new Error("Invalid SSH agent setup request"));
    }
    const requested = [...new Set(stepIds)];
    return this.serialize(async () => {
      const plan = this.heldPlan;
      if (plan == null || plan.planId !== planId) {
        this.deps.logService.warning(`${LOG_PREFIX} apply rejected: unknown plan`);
        return requested.map((stepId) => ({
          stepId,
          status: SshAgentSetupStepStatus.Failed,
          errorCode: "plan-expired" as const,
        }));
      }
      // A plan is single use; a second apply needs a fresh preview.
      this.heldPlan = null;
      const results: SshAgentSetupApplyResult[] = [];
      for (const stepId of requested) {
        const held = plan.steps.get(stepId);
        const result: SshAgentSetupApplyResult =
          held == null
            ? { stepId, status: SshAgentSetupStepStatus.Failed, errorCode: "unknown" }
            : await this.applyStep(held);
        this.deps.logService.info(
          `${LOG_PREFIX} apply ${held != null ? stepId : "unknown-step"} ${result.status}${result.errorCode != null ? ` ${result.errorCode}` : ""}`,
        );
        results.push(result);
      }
      return results;
    });
  }

  undo(): Promise<SshAgentSetupApplyResult[]> {
    return this.serialize(async () => {
      this.heldPlan = null;
      if (this.mode() !== SshAgentSetupMode.Automatic) {
        return [];
      }
      const results: SshAgentSetupApplyResult[] = [];
      const ssh = await this.undoSshConfig();
      if (ssh != null) {
        results.push(ssh);
      }
      for (const shell of Object.values(SshSetupShell)) {
        const result = await this.undoShell(shell);
        if (result != null) {
          results.push(result);
        }
      }
      for (const r of results) {
        this.deps.logService.info(
          `${LOG_PREFIX} undo ${r.stepId} ${r.status}${r.errorCode != null ? ` ${r.errorCode}` : ""}`,
        );
      }
      return results;
    });
  }

  async verify(): Promise<SshAgentVerifyResult> {
    const socket = this.deps.native.getSocketAddress();
    const agent = await this.verifyAgent(socket);
    const shellCheck = await this.verifyShell(socket);
    const shell = shellCheck.outcome;
    const sshCheck = await this.verifySshClient(socket, shell);
    const sshClient = sshCheck.outcome;
    this.deps.logService.info(
      `${LOG_PREFIX} verify agent=${agent} sshClient=${sshClient} shell=${shell}`,
    );
    const details: SshAgentVerifyDetails = {
      ...(socket != null ? { socketAddress: this.displayValue(socket) } : {}),
      ...(sshCheck.identityAgent != null ? { identityAgent: sshCheck.identityAgent } : {}),
      ...(shellCheck.override != null
        ? { overrideFile: shellCheck.override.file, overrideLine: shellCheck.override.line }
        : {}),
    };
    return { agent, sshClient, shell, ...(Object.keys(details).length > 0 ? { details } : {}) };
  }

  private mode(): SshAgentSetupMode {
    return decideMode(this.deps.platform, this.deps.packaging).mode;
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch((): void => undefined);
    return run;
  }

  private planningContext(): PlanningContext {
    return {
      home: this.deps.home,
      socket: this.deps.native.getSocketAddress(),
      safety: { home: this.deps.home, uid: this.deps.uid },
    };
  }

  private paths() {
    const home = this.deps.home;
    const sshDir = path.join(home, ".ssh");
    const appDir = path.join(sshDir, "bitwarden");
    const zdotdir = this.deps.env.ZDOTDIR;
    const xdg = this.deps.env.XDG_CONFIG_HOME;
    const configHome = xdg != null && path.isAbsolute(xdg) ? xdg : path.join(home, ".config");
    const fishDir = path.join(configHome, "fish");
    return {
      sshDir,
      appDir,
      sshConfig: path.join(sshDir, "config"),
      agentConf: path.join(appDir, "agent.conf"),
      zshDir: zdotdir != null && path.isAbsolute(zdotdir) ? zdotdir : home,
      zshrc: path.join(zdotdir != null && path.isAbsolute(zdotdir) ? zdotdir : home, ".zshrc"),
      bashrc: path.join(home, ".bashrc"),
      configHome,
      fishDir,
      fishConfDir: path.join(fishDir, "conf.d"),
      fishDropIn: path.join(fishDir, "conf.d", "bitwarden-ssh-agent.fish"),
      fishConfig: path.join(fishDir, "config.fish"),
    };
  }

  /** In dev/test overrides ssh would expand `~` to the real home, so point at the override. */
  private includeTarget(): string {
    return this.deps.homeOverridden ? this.paths().agentConf : SSH_CONFIG_INCLUDE_TARGET;
  }

  private async computeSteps(): Promise<HeldStep[]> {
    const ctx = this.planningContext();
    const steps = [await this.planStep(SshAgentSetupStepId.SshConfig, () => this.planSsh(ctx))];
    const shell = this.deps.loginShell;
    if (shell != null) {
      const shellStep = await this.planStep(SHELL_STEP_IDS[shell], () =>
        this.planShell(ctx, shell),
      );
      if (shellStep != null) {
        steps.push(shellStep);
      }
    }
    return steps.filter((s): s is HeldStep => s != null);
  }

  /** Runs a planner and turns safety failures into `blocked` steps. */
  private async planStep(
    id: SshAgentSetupStepId,
    planner: () => Promise<HeldStep | null>,
  ): Promise<HeldStep | null> {
    try {
      return await planner();
    } catch (e) {
      const reason =
        e instanceof SshAgentSetupBlockedError ? e.reason : SshAgentSetupBlockedReason.Unreadable;
      this.deps.logService.warning(`${LOG_PREFIX} plan ${id} blocked ${errorClass(e)}`);
      return this.blockedStep(id, this.stepKind(id), this.stepDisplayPath(id), reason);
    }
  }

  private stepDisplayPath(id: SshAgentSetupStepId): string {
    const p = this.paths();
    const target = {
      [SshAgentSetupStepId.SshConfig]: p.sshConfig,
      [SshAgentSetupStepId.ShellZsh]: p.zshrc,
      [SshAgentSetupStepId.ShellBash]: p.bashrc,
      [SshAgentSetupStepId.ShellFish]: p.fishDropIn,
    }[id];
    return displayPath(this.deps.home, target);
  }

  private stepKind(id: SshAgentSetupStepId): SshAgentSetupStepKind {
    return id === SshAgentSetupStepId.SshConfig
      ? SshAgentSetupStepKind.SshConfigInclude
      : SshAgentSetupStepKind.ShellProfile;
  }

  private blockedStep(
    id: string,
    kind: SshAgentSetupStepKind,
    shownPath: string,
    reason: SshAgentSetupBlockedReason,
  ): HeldStep {
    return {
      step: {
        id,
        kind,
        status: SshAgentSetupStepStatus.Blocked,
        displayPath: shownPath,
        addedLines: this.manualLines(id),
        blockedReasonKey: reason,
      },
      targets: [],
      dirs: [],
      writes: [],
    };
  }

  /** Display form of a path or address: `~`-relative inside the home directory, else as is. */
  private displayValue(value: string): string {
    const shown = displayPath(this.deps.home, value);
    return shown !== "" ? shown : sanitizeDisplayLine(value);
  }

  /** Lines a user could add by hand when a step is blocked. Empty when none is safe to show. */
  private manualLines(id: string): string[] {
    const socket = this.deps.native.getSocketAddress();
    if (!isSafeSocketPath(socket)) {
      return [];
    }
    switch (id) {
      case SshAgentSetupStepId.SshConfig:
        return ["Host *", `  IdentityAgent "${this.displayValue(socket)}"`];
      case SshAgentSetupStepId.ShellZsh:
      case SshAgentSetupStepId.ShellBash:
        return posixShellBlockLines(socket);
      case SshAgentSetupStepId.ShellFish:
        return fishDropInContent(socket).replace(/\n$/, "").split("\n");
      default:
        return [];
    }
  }

  private simpleStep(
    id: string,
    kind: SshAgentSetupStepKind,
    shownPath: string,
    status: SshAgentSetupStepStatus,
    conflict?: FoundLine,
  ): HeldStep {
    return {
      step: {
        id,
        kind,
        status,
        displayPath: shownPath,
        addedLines: [],
        ...(conflict != null ? { conflict: this.conflictInfo(conflict) } : {}),
      },
      targets: [],
      dirs: [],
      writes: [],
    };
  }

  private conflictInfo(found: FoundLine): { existingLine: string; lineNumber: number } {
    return { existingLine: sanitizeDisplayLine(found.line), lineNumber: found.lineNumber };
  }

  /** Throws SshAgentSetupBlockedError when any path is unsafe. */
  private async assertSafe(ctx: PlanningContext, files: string[], dirs: string[] = []) {
    for (const file of files) {
      const reason = await checkPathSafety(file, ctx.safety, "file");
      if (reason != null) {
        throw new SshAgentSetupBlockedError(reason);
      }
    }
    for (const dir of dirs) {
      const reason = await checkPathSafety(dir, ctx.safety, "dir");
      if (reason != null) {
        throw new SshAgentSetupBlockedError(reason);
      }
    }
  }

  private socketBlockedReason(socket: string | null): SshAgentSetupBlockedReason {
    return socket == null
      ? SshAgentSetupBlockedReason.NoSocketAddress
      : SshAgentSetupBlockedReason.UnsafeSocketPath;
  }

  private async planSsh(ctx: PlanningContext): Promise<HeldStep> {
    const p = this.paths();
    const id = SshAgentSetupStepId.SshConfig;
    const kind = SshAgentSetupStepKind.SshConfigInclude;
    const shown = displayPath(ctx.home, p.sshConfig);
    const socket = ctx.socket;
    if (!isSafeSocketPath(socket)) {
      return this.blockedStep(id, kind, shown, this.socketBlockedReason(socket));
    }
    const includeTarget = this.includeTarget();
    if (!isSafeSocketPath(includeTarget) && includeTarget !== SSH_CONFIG_INCLUDE_TARGET) {
      return this.blockedStep(id, kind, shown, SshAgentSetupBlockedReason.UnsafeSocketPath);
    }
    await this.assertSafe(ctx, [p.sshConfig, p.agentConf], [p.sshDir, p.appDir]);

    const config = await readExistingFile(p.sshConfig);
    const agentConf = await readExistingFile(p.agentConf);
    const desiredAgentConf = agentConfContent(socket);
    const agentConfOurs = agentConf == null || parseAgentConfSocket(agentConf.content) != null;
    if (!agentConfOurs) {
      return this.blockedStep(id, kind, shown, SshAgentSetupBlockedReason.ManagedBlockModified);
    }
    const lines = config != null ? splitLines(config.content) : [];
    const scan = findManagedBlocks(lines);
    if (scan.malformed || scan.blocks.length > 1) {
      return this.blockedStep(id, kind, shown, SshAgentSetupBlockedReason.ManagedBlockModified);
    }
    const targets = [
      { path: p.sshConfig, hash: config?.hash ?? sha256(null) },
      { path: p.agentConf, hash: agentConf?.hash ?? sha256(null) },
    ];
    const agentConfWrite: FileWrite = {
      path: p.agentConf,
      content: desiredAgentConf,
      mode: 0o600,
      userOwned: false,
    };

    if (scan.blocks.length === 1) {
      if (!isIntactSshConfigBlock(lines, scan.blocks[0], includeTarget)) {
        return this.blockedStep(id, kind, shown, SshAgentSetupBlockedReason.ManagedBlockModified);
      }
      if (agentConf?.content === desiredAgentConf) {
        return this.simpleStep(id, kind, shown, SshAgentSetupStepStatus.AlreadyConfigured);
      }
      // Our block is in place; only the app-owned file needs the current socket address.
      return {
        step: {
          id,
          kind,
          status: SshAgentSetupStepStatus.Pending,
          displayPath: shown,
          addedLines: [],
        },
        targets,
        dirs: [p.sshDir, p.appDir],
        writes: [agentConfWrite],
      };
    }

    const identityAgents = findIdentityAgentLines(lines, scan.blocks);
    const ours = identityAgents.find(
      (f) => f.value != null && expandHome(f.value, ctx.home) === socket,
    );
    const other = identityAgents.find((f) => f !== ours);
    if (ours != null && other == null) {
      return this.simpleStep(id, kind, shown, SshAgentSetupStepStatus.AlreadyConfigured);
    }
    const blockLines = sshConfigBlockLines(includeTarget);
    const newConfig = `${blockLines.join("\n")}\n${config?.content ?? ""}`;
    return {
      step: {
        id,
        kind,
        status: other != null ? SshAgentSetupStepStatus.Conflict : SshAgentSetupStepStatus.Pending,
        displayPath: shown,
        addedLines: blockLines,
        ...(other != null ? { conflict: this.conflictInfo(other) } : {}),
      },
      targets,
      dirs: [p.sshDir, p.appDir],
      writes: [
        agentConfWrite,
        { path: p.sshConfig, content: newConfig, mode: config?.mode ?? 0o600, userOwned: true },
      ],
    };
  }

  /** SSH_AUTH_SOCK of this process, when it points at another agent the user chose. */
  private environmentConflict(socket: string): FoundLine | null {
    const current = this.deps.env.SSH_AUTH_SOCK;
    if (
      current == null ||
      current === "" ||
      current === socket ||
      isSystemDefaultAuthSock(current)
    ) {
      return null;
    }
    return { line: `SSH_AUTH_SOCK=${current}`, lineNumber: 0, value: current };
  }

  private async planShell(ctx: PlanningContext, shell: SshSetupShell): Promise<HeldStep | null> {
    if (shell === SshSetupShell.Fish) {
      return this.planFish(ctx);
    }
    const p = this.paths();
    const id = SHELL_STEP_IDS[shell];
    const kind = SshAgentSetupStepKind.ShellProfile;
    const rc = shell === SshSetupShell.Zsh ? p.zshrc : p.bashrc;
    const rcDir = shell === SshSetupShell.Zsh ? p.zshDir : ctx.home;
    const shown = displayPath(ctx.home, rc);
    await this.assertSafe(ctx, [rc], rcDir === ctx.home ? [] : [rcDir]);
    const existing = await readExistingFile(rc);
    if (shell === SshSetupShell.Bash && existing == null) {
      // Only touch ~/.bashrc when the user already has one.
      return null;
    }
    const socket = ctx.socket;
    if (!isSafeSocketPath(socket)) {
      return this.blockedStep(id, kind, shown, this.socketBlockedReason(socket));
    }
    const lines = existing != null ? splitLines(existing.content) : [];
    const scan = findManagedBlocks(lines);
    if (scan.malformed || scan.blocks.length > 1) {
      return this.blockedStep(id, kind, shown, SshAgentSetupBlockedReason.ManagedBlockModified);
    }
    const blockLines = posixShellBlockLines(socket);
    const targets = [{ path: rc, hash: existing?.hash ?? sha256(null) }];
    const mode = existing?.mode ?? 0o600;

    if (scan.blocks.length === 1) {
      const blockSocket = parsePosixBlockSocket(lines, scan.blocks[0]);
      if (blockSocket == null) {
        return this.blockedStep(id, kind, shown, SshAgentSetupBlockedReason.ManagedBlockModified);
      }
      if (blockSocket === socket) {
        return this.simpleStep(id, kind, shown, SshAgentSetupStepStatus.AlreadyConfigured);
      }
      // The socket address moved: replace our block in place.
      const { start, end } = scan.blocks[0];
      const updated = [...lines.slice(0, start), ...blockLines, ...lines.slice(end + 1)];
      return {
        step: {
          id,
          kind,
          status: SshAgentSetupStepStatus.Pending,
          displayPath: shown,
          addedLines: blockLines,
        },
        targets,
        dirs: rcDir === ctx.home ? [] : [rcDir],
        writes: [{ path: rc, content: updated.join("\n"), mode, userOwned: true }],
      };
    }

    const assignments = findSshAuthSockAssignments(lines, scan.blocks);
    const ours = assignments.find(
      (f) => f.value != null && expandHome(f.value, ctx.home) === socket,
    );
    const other = assignments.find((f) => f !== ours) ?? null;
    if (ours != null && other == null) {
      return this.simpleStep(id, kind, shown, SshAgentSetupStepStatus.AlreadyConfigured);
    }
    const conflict = other ?? (ours == null ? this.environmentConflict(socket) : null);
    const prefix =
      existing == null || existing.content === ""
        ? ""
        : existing.content.endsWith("\n")
          ? existing.content
          : `${existing.content}\n`;
    return {
      step: {
        id,
        kind,
        status:
          conflict != null ? SshAgentSetupStepStatus.Conflict : SshAgentSetupStepStatus.Pending,
        displayPath: shown,
        addedLines: blockLines,
        ...(conflict != null ? { conflict: this.conflictInfo(conflict) } : {}),
      },
      targets,
      dirs: rcDir === ctx.home ? [] : [rcDir],
      writes: [{ path: rc, content: `${prefix}${blockLines.join("\n")}\n`, mode, userOwned: true }],
    };
  }

  private async planFish(ctx: PlanningContext): Promise<HeldStep> {
    const p = this.paths();
    const id = SshAgentSetupStepId.ShellFish;
    const kind = SshAgentSetupStepKind.ShellProfile;
    const shown = displayPath(ctx.home, p.fishDropIn);
    const socket = ctx.socket;
    if (!isSafeSocketPath(socket)) {
      return this.blockedStep(id, kind, shown, this.socketBlockedReason(socket));
    }
    await this.assertSafe(
      ctx,
      [p.fishDropIn, p.fishConfig],
      [p.configHome, p.fishDir, p.fishConfDir],
    );
    const dropIn = await readExistingFile(p.fishDropIn);
    const desired = fishDropInContent(socket);
    if (dropIn != null && parseFishDropInSocket(dropIn.content) == null) {
      return this.blockedStep(id, kind, shown, SshAgentSetupBlockedReason.ManagedBlockModified);
    }
    if (dropIn?.content === desired) {
      return this.simpleStep(id, kind, shown, SshAgentSetupStepStatus.AlreadyConfigured);
    }
    // conf.d runs before config.fish, so an assignment there would win over ours.
    const fishConfig = await readExistingFile(p.fishConfig);
    const assignments =
      fishConfig != null ? findSshAuthSockAssignments(splitLines(fishConfig.content), []) : [];
    const conflict = assignments[0] ?? this.environmentConflict(socket);
    return {
      step: {
        id,
        kind,
        status:
          conflict != null ? SshAgentSetupStepStatus.Conflict : SshAgentSetupStepStatus.Pending,
        displayPath: shown,
        addedLines: desired.replace(/\n$/, "").split("\n"),
        ...(conflict != null ? { conflict: this.conflictInfo(conflict) } : {}),
      },
      targets: [{ path: p.fishDropIn, hash: dropIn?.hash ?? sha256(null) }],
      dirs: [p.configHome, p.fishDir, p.fishConfDir],
      writes: [{ path: p.fishDropIn, content: desired, mode: 0o600, userOwned: false }],
    };
  }

  private guidedCommands(held: HeldStep[]): SshAgentSetupPlan["guidedCommands"] {
    const socket = this.deps.native.getSocketAddress();
    const mode = this.mode();
    if (this.deps.platform === SshAgentSetupPlatform.Windows) {
      return [
        {
          id: "windows-disable-openssh-agent",
          command: WINDOWS_DISABLE_OPENSSH_AGENT_COMMAND,
          descriptionKey: "sshAgentSetupGuidedCommandWindowsDisableOpenSshAgent",
        },
      ];
    }
    const hasShellStep = held.some((h) => h.step.kind === SshAgentSetupStepKind.ShellProfile);
    if (!isSafeSocketPath(socket) || (mode === SshAgentSetupMode.Automatic && hasShellStep)) {
      return [];
    }
    return [
      {
        id: "posix-export",
        command: guidedPosixExportCommand(socket),
        descriptionKey: "sshAgentSetupGuidedCommandPosixExport",
      },
      {
        id: "fish-export",
        command: guidedFishExportCommand(socket),
        descriptionKey: "sshAgentSetupGuidedCommandFishExport",
      },
    ];
  }

  private writeErrorClass(e: unknown): SshAgentSetupWriteErrorClass {
    switch (errorClass(e)) {
      case "EROFS":
        return "read-only";
      case "ENOSPC":
      case "EDQUOT":
        return "no-space";
      case "EACCES":
      case "EPERM":
        return "permission";
      default:
        return "other";
    }
  }

  private async applyStep(held: HeldStep): Promise<SshAgentSetupApplyResult> {
    const stepId = held.step.id;
    const shown = held.step.displayPath;
    if (held.step.status === SshAgentSetupStepStatus.Blocked) {
      return {
        stepId,
        status: SshAgentSetupStepStatus.Blocked,
        errorCode: "blocked",
        displayPath: shown,
        ...(held.step.blockedReasonKey != null
          ? { blockedReasonKey: held.step.blockedReasonKey }
          : {}),
      };
    }
    if (held.step.status === SshAgentSetupStepStatus.AlreadyConfigured) {
      return { stepId, status: SshAgentSetupStepStatus.AlreadyConfigured, displayPath: shown };
    }
    const ctx = this.planningContext();
    try {
      // Re-check safety and content at write time; anything that moved since the preview aborts.
      await this.assertSafe(
        ctx,
        held.targets.map((t) => t.path),
        held.dirs,
      );
      const current = new Map<string, ExistingFile | null>();
      for (const target of held.targets) {
        const file = await readExistingFile(target.path);
        if ((file?.hash ?? sha256(null)) !== target.hash) {
          return {
            stepId,
            status: SshAgentSetupStepStatus.Failed,
            errorCode: "changed-since-preview",
            displayPath: shown,
          };
        }
        current.set(target.path, file);
      }
      for (const dir of held.dirs) {
        await ensureDirectory(dir, ctx.safety);
      }
      for (const write of held.writes) {
        const before = current.get(write.path);
        if (write.userOwned && before != null) {
          await createBackup(write.path, before.content, this.deps.now());
        }
        await atomicWriteFile(write.path, write.content, write.mode);
      }
      return { stepId, status: SshAgentSetupStepStatus.Applied, displayPath: shown };
    } catch (e) {
      this.deps.logService.warning(`${LOG_PREFIX} apply ${stepId} error ${errorClass(e)}`);
      if (e instanceof SshAgentSetupBlockedError) {
        return {
          stepId,
          status: SshAgentSetupStepStatus.Blocked,
          errorCode: "blocked",
          displayPath: shown,
          blockedReasonKey: e.reason,
        };
      }
      return {
        stepId,
        status: SshAgentSetupStepStatus.Failed,
        errorCode: "write-failed",
        displayPath: shown,
        writeErrorClass: this.writeErrorClass(e),
      };
    }
  }

  private failed(
    stepId: string,
    errorCode: SshAgentSetupApplyResult["errorCode"],
  ): SshAgentSetupApplyResult {
    return { stepId, status: SshAgentSetupStepStatus.Failed, errorCode };
  }

  /** Removes our block from a user file, keeping every other line exactly as it is. */
  private async removeBlock(
    file: string,
    existing: ExistingFile,
    block: ManagedBlockRange,
  ): Promise<void> {
    const remaining = removeRanges(splitLines(existing.content), [block]).join("\n");
    await createBackup(file, existing.content, this.deps.now());
    await atomicWriteFile(file, remaining, existing.mode);
  }

  private async undoSshConfig(): Promise<SshAgentSetupApplyResult | null> {
    const id = SshAgentSetupStepId.SshConfig;
    const p = this.paths();
    const ctx = this.planningContext();
    try {
      await this.assertSafe(ctx, [p.sshConfig, p.agentConf], [p.sshDir, p.appDir]);
      const config = await readExistingFile(p.sshConfig);
      const agentConf = await readExistingFile(p.agentConf);
      const lines = config != null ? splitLines(config.content) : [];
      const scan = findManagedBlocks(lines);
      if (scan.blocks.length === 0 && !scan.malformed && agentConf == null) {
        return null;
      }
      const intact =
        !scan.malformed &&
        scan.blocks.length <= 1 &&
        scan.blocks.every((b) => isIntactSshConfigBlock(lines, b, this.includeTarget())) &&
        (agentConf == null || parseAgentConfSocket(agentConf.content) != null);
      if (!intact) {
        return this.failed(id, "changed-since-preview");
      }
      if (config != null && scan.blocks.length === 1) {
        await this.removeBlock(p.sshConfig, config, scan.blocks[0]);
      }
      await removeFile(p.agentConf);
      await removeDirectoryIfEmpty(p.appDir);
      return { stepId: id, status: SshAgentSetupStepStatus.Applied };
    } catch (e) {
      return this.undoError(id, e);
    }
  }

  private async undoShell(shell: SshSetupShell): Promise<SshAgentSetupApplyResult | null> {
    const id = SHELL_STEP_IDS[shell];
    const p = this.paths();
    const ctx = this.planningContext();
    try {
      if (shell === SshSetupShell.Fish) {
        await this.assertSafe(ctx, [p.fishDropIn]);
        const dropIn = await readExistingFile(p.fishDropIn);
        if (dropIn == null) {
          return null;
        }
        if (parseFishDropInSocket(dropIn.content) == null) {
          return this.failed(id, "changed-since-preview");
        }
        await removeFile(p.fishDropIn);
        return { stepId: id, status: SshAgentSetupStepStatus.Applied };
      }
      const rc = shell === SshSetupShell.Zsh ? p.zshrc : p.bashrc;
      await this.assertSafe(ctx, [rc]);
      const existing = await readExistingFile(rc);
      if (existing == null) {
        return null;
      }
      const lines = splitLines(existing.content);
      const scan = findManagedBlocks(lines);
      if (scan.blocks.length === 0 && !scan.malformed) {
        return null;
      }
      if (
        scan.malformed ||
        scan.blocks.length !== 1 ||
        parsePosixBlockSocket(lines, scan.blocks[0]) == null
      ) {
        return this.failed(id, "changed-since-preview");
      }
      await this.removeBlock(rc, existing, scan.blocks[0]);
      return { stepId: id, status: SshAgentSetupStepStatus.Applied };
    } catch (e) {
      return this.undoError(id, e);
    }
  }

  private undoError(stepId: string, e: unknown): SshAgentSetupApplyResult {
    this.deps.logService.warning(`${LOG_PREFIX} undo ${stepId} error ${errorClass(e)}`);
    return e instanceof SshAgentSetupBlockedError
      ? {
          stepId,
          status: SshAgentSetupStepStatus.Blocked,
          errorCode: "blocked",
          blockedReasonKey: e.reason,
        }
      : { ...this.failed(stepId, "write-failed"), writeErrorClass: this.writeErrorClass(e) };
  }

  private async verifyAgent(socket: string | null): Promise<SshAgentVerifyOutcome> {
    if (!this.deps.agentState.isEnabled() && !this.deps.agentState.isRunning()) {
      return SshAgentVerifyOutcome.NotChecked;
    }
    if (socket == null) {
      return SshAgentVerifyOutcome.Unreachable;
    }
    return (await this.deps.native.probeAddress(socket))
      ? SshAgentVerifyOutcome.Ok
      : SshAgentVerifyOutcome.Unreachable;
  }

  private async verifySshClient(
    socket: string | null,
    shell: SshAgentVerifyOutcome,
  ): Promise<{ outcome: SshAgentVerifyOutcome; identityAgent?: string }> {
    const notChecked = { outcome: SshAgentVerifyOutcome.NotChecked };
    if (socket == null || this.deps.packaging !== SshAgentSetupPackaging.Standard) {
      return notChecked;
    }
    const windows = this.deps.platform === SshAgentSetupPlatform.Windows;
    const identityAgent = await readSshClientIdentityAgent({
      windows,
      home: this.deps.home,
      configFile: this.deps.homeOverridden ? this.paths().sshConfig : null,
      binaries: this.deps.sshBinaries,
      execFile: this.deps.execFile,
    });
    if (identityAgent === undefined) {
      return notChecked;
    }
    if (identityAgent === null || identityAgent === "SSH_AUTH_SOCK") {
      // No IdentityAgent: ssh uses SSH_AUTH_SOCK (or the default pipe on Windows).
      if (windows) {
        return {
          outcome:
            socket === WINDOWS_DEFAULT_AGENT_PIPE
              ? SshAgentVerifyOutcome.Ok
              : SshAgentVerifyOutcome.OtherAgent,
        };
      }
      return {
        outcome:
          shell === SshAgentVerifyOutcome.NotChecked ||
          shell === SshAgentVerifyOutcome.Ok ||
          shell === SshAgentVerifyOutcome.NotConfigured
            ? shell
            : SshAgentVerifyOutcome.OtherAgent,
      };
    }
    if (expandHome(identityAgent, this.deps.home) === socket) {
      return { outcome: SshAgentVerifyOutcome.Ok };
    }
    return {
      outcome: SshAgentVerifyOutcome.OtherAgent,
      identityAgent: this.displayValue(expandHome(identityAgent, this.deps.home)),
    };
  }

  /**
   * Decides what a new shell would see without running it: inspects the block or drop-in we wrote
   * and looks for later assignments in the same file that would override it.
   */
  private async verifyShell(socket: string | null): Promise<ShellCheck> {
    const shell = this.deps.loginShell;
    if (this.mode() !== SshAgentSetupMode.Automatic || shell == null || socket == null) {
      return { outcome: SshAgentVerifyOutcome.NotChecked };
    }
    const p = this.paths();
    const ctx = this.planningContext();
    try {
      if (shell === SshSetupShell.Fish) {
        await this.assertSafe(ctx, [p.fishDropIn, p.fishConfig]);
        const dropIn = await readExistingFile(p.fishDropIn);
        const fishConfig = await readExistingFile(p.fishConfig);
        const overrides =
          fishConfig != null ? findSshAuthSockAssignments(splitLines(fishConfig.content), []) : [];
        if (dropIn != null && parseFishDropInSocket(dropIn.content) === socket) {
          return overrides.length > 0
            ? this.overriddenShell(p.fishConfig, overrides[0])
            : { outcome: SshAgentVerifyOutcome.Ok };
        }
        return { outcome: this.unconfiguredShellOutcome(socket) };
      }
      const rc = shell === SshSetupShell.Zsh ? p.zshrc : p.bashrc;
      await this.assertSafe(ctx, [rc]);
      const existing = await readExistingFile(rc);
      const lines = existing != null ? splitLines(existing.content) : [];
      const scan = findManagedBlocks(lines);
      const assignments = findSshAuthSockAssignments(lines, scan.blocks);
      const ourBlock = scan.malformed
        ? undefined
        : scan.blocks.find((b) => parsePosixBlockSocket(lines, b) === socket);
      if (ourBlock != null) {
        const laterOverride = assignments.find(
          (f) =>
            f.lineNumber - 1 > ourBlock.end &&
            (f.value == null || expandHome(f.value, this.deps.home) !== socket),
        );
        return laterOverride != null
          ? this.overriddenShell(rc, laterOverride)
          : { outcome: SshAgentVerifyOutcome.Ok };
      }
      const manual = assignments.filter(
        (f) => f.value != null && expandHome(f.value, this.deps.home) === socket,
      );
      if (manual.length > 0 && manual.length === assignments.length) {
        return { outcome: SshAgentVerifyOutcome.Ok };
      }
      return { outcome: this.unconfiguredShellOutcome(socket) };
    } catch (e) {
      this.deps.logService.warning(`${LOG_PREFIX} verify shell error ${errorClass(e)}`);
      return { outcome: SshAgentVerifyOutcome.NotChecked };
    }
  }

  private overriddenShell(file: string, found: FoundLine): ShellCheck {
    return {
      outcome: SshAgentVerifyOutcome.OtherAgent,
      override: { file: displayPath(this.deps.home, file), line: found.lineNumber },
    };
  }

  /** Bitwarden's block is not in the profile: new terminals only work if they inherit the address. */
  private unconfiguredShellOutcome(socket: string): SshAgentVerifyOutcome {
    return this.deps.env.SSH_AUTH_SOCK === socket
      ? SshAgentVerifyOutcome.Ok
      : SshAgentVerifyOutcome.NotConfigured;
  }
}

interface ShellCheck {
  outcome: SshAgentVerifyOutcome;
  /** Where a later SSH_AUTH_SOCK assignment replaces the Bitwarden block. */
  override?: { file: string; line: number };
}

/**
 * Registers the IPC handlers. Each handler forwards only the documented arguments; any extra
 * renderer-supplied values (paths, content, argv) are dropped here.
 */
export function registerSshAgentSetupIpcHandlers(service: SshAgentSetupApi): void {
  ipcMain.handle(SSH_AGENT_SETUP_IPC_CHANNELS.GET_ENVIRONMENT, () => service.getEnvironment());
  ipcMain.handle(SSH_AGENT_SETUP_IPC_CHANNELS.GET_STATUS, () => service.getStatus());
  ipcMain.handle(SSH_AGENT_SETUP_IPC_CHANNELS.GET_PLAN, () => service.getPlan());
  ipcMain.handle(SSH_AGENT_SETUP_IPC_CHANNELS.APPLY, (_event, planId: string, stepIds: string[]) =>
    service.apply(planId, stepIds),
  );
  ipcMain.handle(SSH_AGENT_SETUP_IPC_CHANNELS.UNDO, () => service.undo());
  ipcMain.handle(SSH_AGENT_SETUP_IPC_CHANNELS.VERIFY, () => service.verify());
}
