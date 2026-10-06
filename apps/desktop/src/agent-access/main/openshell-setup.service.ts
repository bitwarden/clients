import { execFile } from "child_process";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  OPENSHELL_DEFAULT_GATEWAY_NAME,
  OPENSHELL_DRIVER_SOCKET_FILENAME,
  OpenShellDetectionResult,
  OpenShellRestartMethod,
  OpenShellSetupFailure,
  OpenShellSetupResult,
  OpenShellSetupStatus,
} from "../models/openshell";
import { OpenShellSnippetInput } from "../utils/openshell-config-snippet.util";
import {
  GatewayConfigEdit,
  isGatewayConfigCurrent,
  mergeGatewayConfig,
  removeFromGatewayConfig,
} from "../utils/openshell-gateway-config.util";

/** A gateway.toml is a few hundred bytes; anything past this is not one worth editing. */
const MAX_CONFIG_BYTES = 256 * 1024;

const BREW_CANDIDATES = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
const SYSTEMCTL_CANDIDATES = ["/usr/bin/systemctl", "/bin/systemctl"];
const SYSTEMD_UNIT = "openshell-gateway.service";

const LIST_TIMEOUT_MS = 10_000;
const RESTART_TIMEOUT_MS = 60_000;

/**
 * The only filesystem operations setup performs, all on one `gateway.toml` and its siblings.
 * Injected so tests can assert exactly what would be touched and never write a real config.
 */
export interface OpenShellSetupFs {
  /** The file's text, `null` when it doesn't exist; throws for any other failure or when larger
   *  than `maxBytes`. */
  read(filePath: string, maxBytes: number): Promise<string | null>;
  /** Replaces `filePath` with `content` atomically (write a sibling temp file, then rename),
   *  keeping the existing file's permissions. */
  writeAtomic(filePath: string, content: string): Promise<void>;
  /** Copies `from` to `to`, never overwriting an existing `to`. */
  copyExclusive(from: string, to: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
}

export interface OpenShellSetupExecResult {
  code: number;
  stdout: string;
}

/**
 * Runs one program by absolute path with an explicit argument list: no shell, a fixed `PATH`, and
 * a timeout. A Dock-launched app inherits launchd's minimal `PATH`, so nothing here may rely on
 * the user's shell environment.
 */
export interface OpenShellSetupExec {
  run(file: string, args: string[], timeoutMs: number): Promise<OpenShellSetupExecResult>;
}

const nodeFs: OpenShellSetupFs = {
  async read(filePath, maxBytes) {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > maxBytes) {
        throw new Error("not a regular file of reasonable size");
      }
      return await fs.readFile(filePath, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw e;
    }
  },
  async writeAtomic(filePath, content) {
    let mode = 0o644;
    try {
      mode = (await fs.stat(filePath)).mode & 0o777;
    } catch {
      // New file: default mode.
    }
    const temp = `${filePath}.bitwarden-tmp-${process.pid}`;
    try {
      await fs.writeFile(temp, content, { mode });
      await fs.rename(temp, filePath);
    } catch (e) {
      await fs.rm(temp, { force: true });
      throw e;
    }
  },
  async copyExclusive(from, to) {
    await fs.copyFile(from, to, 1 /* COPYFILE_EXCL */);
  },
  async exists(filePath) {
    try {
      return (await fs.stat(filePath)).isFile();
    } catch {
      return false;
    }
  },
};

const nodeExec: OpenShellSetupExec = {
  run(file, args, timeoutMs) {
    return new Promise((resolve) => {
      execFile(
        file,
        args,
        {
          timeout: timeoutMs,
          env: {
            PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
            HOME: os.homedir(),
            // `systemctl --user` needs to find the user's bus.
            ...(process.env.XDG_RUNTIME_DIR != null
              ? { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR }
              : {}),
          },
          maxBuffer: 1024 * 1024,
        },
        (error, stdout) => {
          const code =
            error == null ? 0 : typeof (error as any).code === "number" ? (error as any).code : 1;
          resolve({ code, stdout: String(stdout ?? "") });
        },
      );
    });
  },
};

/** `YYYYMMDDHHMMSS`, local time — a backup name a person can read. */
function backupStamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * The one-button OpenShell setup (agent-access-architecture.md, §M8.19): adds the Bitwarden
 * credential driver to the gateway's `gateway.toml` and restarts the gateway, so the user doesn't
 * copy a snippet, merge it by hand and find the right restart command.
 *
 * Everything it touches is chosen here, never by the renderer: the config path comes from
 * detection, the driver `command` is the bundled `aac`, the socket path is the fixed
 * home-relative one, and the restart is `brew services restart` or `systemctl --user restart`
 * on a service it located itself. The edit is a surgical text merge that keeps the user's
 * comments and other tables, preceded by a timestamped backup and written atomically. A file the
 * merge can't safely edit is left untouched, and the caller falls back to the manual snippet.
 *
 * It never starts or stops a sandbox and never talks to the gateway's API.
 */
export class OpenShellSetupService {
  constructor(
    private logService: LogService,
    private detect: () => Promise<OpenShellDetectionResult>,
    private getBundledCliPath: () => Promise<string | null>,
    private homedir: string = os.homedir(),
    private platform: NodeJS.Platform = process.platform,
    private fsAdapter: OpenShellSetupFs = nodeFs,
    private exec: OpenShellSetupExec = nodeExec,
    private now: () => Date = () => new Date(),
  ) {}

  /** Read-only: what setup would do here, and whether the config already has it. */
  async getStatus(): Promise<OpenShellSetupStatus> {
    const detection = await this.detect();
    const configPath = detection.gatewayConfigPathHint;
    const restartMethod = await this.restartMethod(detection);

    const blocked = await this.blockedBy(detection);
    if (blocked != null) {
      return {
        configPath,
        configured: false,
        canSetUp: false,
        blockedReason: blocked,
        restartMethod,
      };
    }

    const input = (await this.snippetInput(detection))!;
    let existing: string | null;
    try {
      existing = await this.fsAdapter.read(configPath, MAX_CONFIG_BYTES);
    } catch {
      return {
        configPath,
        configured: false,
        canSetUp: false,
        blockedReason: "notWritable",
        restartMethod,
      };
    }

    const edit = mergeGatewayConfig(existing, input);
    if (edit.kind === "unmergeable") {
      return {
        configPath,
        configured: false,
        canSetUp: true,
        blockedReason: "unmergeable",
        restartMethod,
      };
    }
    return {
      configPath,
      configured: existing != null && isGatewayConfigCurrent(existing, input),
      canSetUp: true,
      restartMethod,
    };
  }

  /** Writes the driver into `gateway.toml` (backing the old file up first) and restarts the
   *  gateway. Idempotent: an already-correct config is not rewritten, but the gateway is still
   *  restarted so a driver that never connected gets another chance. */
  async setUp(): Promise<OpenShellSetupResult> {
    return this.apply((existing, input) => mergeGatewayConfig(existing, input));
  }

  /** Takes the Bitwarden driver back out of `gateway.toml` and restarts the gateway. */
  async remove(): Promise<OpenShellSetupResult> {
    return this.apply((existing) =>
      existing == null
        ? { kind: "ok", content: "", changed: false }
        : removeFromGatewayConfig(existing),
    );
  }

  private async apply(
    edit: (existing: string | null, input: OpenShellSnippetInput) => GatewayConfigEdit,
  ): Promise<OpenShellSetupResult> {
    const detection = await this.detect();
    const restartMethod = await this.restartMethod(detection);
    const fail = (
      failure: OpenShellSetupFailure,
      extra: Partial<OpenShellSetupResult> = {},
    ): OpenShellSetupResult => ({
      ok: false,
      failure,
      configChanged: false,
      restarted: false,
      restartMethod,
      ...extra,
    });

    const blocked = await this.blockedBy(detection);
    if (blocked != null) {
      return fail(blocked);
    }
    const input = (await this.snippetInput(detection))!;
    const configPath = detection.gatewayConfigPathHint;

    let existing: string | null;
    try {
      existing = await this.fsAdapter.read(configPath, MAX_CONFIG_BYTES);
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell setup could not read the config: ${e}`);
      return fail("notWritable");
    }

    const result = edit(existing, input);
    if (result.kind === "unmergeable") {
      return fail("unmergeable", { detail: result.reason });
    }

    let backupPath: string | undefined;
    if (result.changed) {
      try {
        if (existing != null) {
          backupPath = `${configPath}.bak-bitwarden-${backupStamp(this.now())}`;
          await this.fsAdapter.copyExclusive(configPath, backupPath);
        }
        await this.fsAdapter.writeAtomic(configPath, result.content);
      } catch (e) {
        // Nothing is half-written: the backup is a copy and the write is a rename.
        this.logService.warning(`[Agent Access] OpenShell setup could not write the config: ${e}`);
        return fail("notWritable");
      }
    }

    const restarted = await this.restartGateway(restartMethod);
    if (!restarted) {
      return fail("restartFailed", {
        configChanged: result.changed,
        ...(backupPath != null ? { backupPath } : {}),
      });
    }
    return {
      ok: true,
      configChanged: result.changed,
      restarted: true,
      restartedAtMs: Date.now(),
      restartMethod,
      ...(backupPath != null ? { backupPath } : {}),
    };
  }

  private async blockedBy(
    detection: OpenShellDetectionResult,
  ): Promise<OpenShellSetupFailure | null> {
    if (!detection.present || !detection.platformSupported) {
      return "unsupported";
    }
    if ((await this.getBundledCliPath()) == null) {
      return "noBundledCli";
    }
    return null;
  }

  private async snippetInput(
    detection: OpenShellDetectionResult,
  ): Promise<OpenShellSnippetInput | null> {
    const aacPath = await this.getBundledCliPath();
    if (aacPath == null) {
      return null;
    }
    return {
      aacPath,
      gatewayName:
        detection.gateways.find((gateway) => gateway.active)?.name ??
        detection.gateways[0]?.name ??
        OPENSHELL_DEFAULT_GATEWAY_NAME,
      driverSocketPath: path.join(this.homedir, OPENSHELL_DRIVER_SOCKET_FILENAME),
    };
  }

  private async restartMethod(
    detection: OpenShellDetectionResult,
  ): Promise<OpenShellRestartMethod> {
    if (this.platform === "darwin" && (await this.firstExisting(BREW_CANDIDATES)) != null) {
      return "brew";
    }
    if (
      this.platform === "linux" &&
      detection.systemdUnitPath != null &&
      (await this.firstExisting(SYSTEMCTL_CANDIDATES)) != null
    ) {
      return "systemd";
    }
    return "manual";
  }

  private async firstExisting(candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
      if (await this.fsAdapter.exists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private async restartGateway(method: OpenShellRestartMethod): Promise<boolean> {
    try {
      if (method === "brew") {
        const brew = (await this.firstExisting(BREW_CANDIDATES))!;
        const service = await this.findBrewService(brew);
        if (service == null) {
          return false;
        }
        return (
          (await this.exec.run(brew, ["services", "restart", service], RESTART_TIMEOUT_MS)).code ===
          0
        );
      }
      if (method === "systemd") {
        const systemctl = (await this.firstExisting(SYSTEMCTL_CANDIDATES))!;
        return (
          (await this.exec.run(systemctl, ["--user", "restart", SYSTEMD_UNIT], RESTART_TIMEOUT_MS))
            .code === 0
        );
      }
      return false;
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell gateway restart failed: ${e}`);
      return false;
    }
  }

  /** The brew service for the gateway: found by listing the user's own services, never guessed
   *  from a hard-coded tap. `null` when none looks like OpenShell. */
  private async findBrewService(brew: string): Promise<string | null> {
    const listed = await this.exec.run(brew, ["services", "list", "--json"], LIST_TIMEOUT_MS);
    if (listed.code !== 0) {
      return null;
    }
    try {
      const services: unknown = JSON.parse(listed.stdout);
      if (!Array.isArray(services)) {
        return null;
      }
      const names = services
        .map((service) => (service as { name?: unknown }).name)
        .filter((name): name is string => typeof name === "string" && /^[\w./@+-]+$/.test(name))
        .filter((name) => name.toLowerCase().includes("openshell"));
      return names.find((name) => name === "openshell") ?? names[0] ?? null;
    } catch {
      return null;
    }
  }
}
