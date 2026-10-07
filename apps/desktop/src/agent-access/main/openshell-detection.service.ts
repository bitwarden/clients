import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  isOpenShellGatewayName,
  OpenShellDetectionResult,
  OpenShellGatewayInfo,
  OpenShellUnsupportedReason,
} from "../models/openshell";

/** Cap on any file detection reads (§M8.8: `active_gateway` and `metadata.json`). */
const MAX_READ_BYTES = 64 * 1024;

/**
 * Minimal, read-only fs surface. Injected so tests never touch the real filesystem, and so the
 * spec can assert exactly which paths were ever probed or read.
 */
export interface OpenShellDetectionFs {
  /** Whether a regular file (or symlink to one) exists at `filePath`. */
  exists(filePath: string): Promise<boolean>;
  /** Contents of a regular, non-symlink file of at most `maxBytes`, else `null`. */
  readSmallFile(filePath: string, maxBytes: number): Promise<string | null>;
  /** Names of the real (non-symlink) subdirectories of `dirPath`; empty when unreadable. */
  listSubdirectories(dirPath: string): Promise<string[]>;
}

const nodeFs: OpenShellDetectionFs = {
  async exists(filePath) {
    try {
      return (await fs.stat(filePath)).isFile();
    } catch {
      return false;
    }
  },
  async readSmallFile(filePath, maxBytes) {
    try {
      // lstat, not stat: a symlinked metadata file could point anywhere (including at
      // `mtls/tls.key`), and detection must never open OpenShell credential material.
      const stat = await fs.lstat(filePath);
      if (!stat.isFile() || stat.size > maxBytes) {
        return null;
      }
      return await fs.readFile(filePath, "utf8");
    } catch {
      return null;
    }
  },
  async listSubdirectories(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  },
};

/** Fixed (non-PATH) directories probed for the two binaries, after `PATH` (§M8.8). */
const FIXED_BIN_DIRS = [
  "/usr/local/bin",
  "/usr/bin",
  "/opt/homebrew/bin",
  "/opt/homebrew/opt/openshell/bin",
];

const SNAP_CLI_PATH = "/snap/bin/openshell";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

/** `true` when `endpoint`'s host is loopback (§M8.5: plaintext gateway auth is allowed only
 *  there). Unparseable endpoints are not loopback. */
export function isLoopbackEndpoint(endpoint: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(endpoint).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** §M8.8: `authSupported = authMode === "mtls" || (authMode === "plaintext" && loopback)`. */
export function isSupportedGatewayAuth(authMode: string, endpoint: string): boolean {
  return authMode === "mtls" || (authMode === "plaintext" && isLoopbackEndpoint(endpoint));
}

/**
 * Detects whether OpenShell is installed (agent-access-architecture.md, §M8.8), so the Setup tab
 * only offers the integration when there is something to integrate with.
 *
 * It **never spawns a process and never opens a network connection**: presence is a handful of
 * `exists` checks, and the only files ever read are the client config dir's `active_gateway` and
 * each `gateways/<name>/metadata.json` (at most 64 KiB, and only `gateway_endpoint` and
 * `auth_mode` are kept). `mtls/*`, `edge_token` and `oidc_token.json` are never opened.
 *
 * Never throws: every probe failure reads as "not found".
 */
export class OpenShellDetectionService {
  constructor(
    private logService: LogService,
    private homedir: string = os.homedir(),
    private env: NodeJS.ProcessEnv = process.env,
    private platform: NodeJS.Platform = process.platform,
    private fsAdapter: OpenShellDetectionFs = nodeFs,
  ) {}

  async detect(): Promise<OpenShellDetectionResult> {
    if (this.platform === "win32") {
      // Not even probed: there is nothing on Windows this integration supports.
      return {
        present: false,
        platformSupported: false,
        unsupportedReason: "windows",
        gateways: [],
        gatewayConfigPathHint: "",
      };
    }

    try {
      return await this.detectUnix();
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell detection failed: ${e}`);
      return {
        present: false,
        platformSupported: false,
        gateways: [],
        gatewayConfigPathHint: "",
      };
    }
  }

  private async detectUnix(): Promise<OpenShellDetectionResult> {
    const binDirs = this.binDirectories();
    const cliHits = await this.findAll(binDirs, "openshell");
    const gatewayBinaryPath = (await this.findAll(binDirs, "openshell-gateway"))[0];
    const configDir = this.clientConfigDir();

    const gatewayConfigCandidates = [
      path.join(configDir, "gateway.toml"),
      "/opt/homebrew/var/openshell/gateway.toml",
      "/usr/local/var/openshell/gateway.toml",
    ];
    const gatewayConfigPath = await this.firstExisting(gatewayConfigCandidates);

    const systemdUnitPath =
      this.platform === "linux"
        ? await this.firstExisting([
            path.join(this.homedir, ".config", "systemd", "user", "openshell-gateway.service"),
            "/usr/lib/systemd/user/openshell-gateway.service",
            "/etc/systemd/user/openshell-gateway.service",
          ])
        : undefined;

    // Prefer a non-Snap CLI for display; a Snap CLI alone marks the install as Snap.
    const cliPath = cliHits.find((hit) => hit !== SNAP_CLI_PATH) ?? cliHits[0];
    const unsupportedReason = this.unsupportedReason(cliHits);
    const platformSupported =
      (this.platform === "darwin" || this.platform === "linux") && unsupportedReason == null;

    const gateways = await this.readGateways(configDir);

    return {
      present:
        cliPath != null ||
        gatewayBinaryPath != null ||
        gatewayConfigPath != null ||
        systemdUnitPath != null,
      platformSupported,
      ...(unsupportedReason != null ? { unsupportedReason } : {}),
      ...(cliPath != null ? { cliPath } : {}),
      ...(gatewayBinaryPath != null ? { gatewayBinaryPath } : {}),
      ...(gatewayConfigPath != null ? { gatewayConfigPath } : {}),
      ...(systemdUnitPath != null ? { systemdUnitPath } : {}),
      gateways,
      gatewayConfigPathHint: gatewayConfigPath ?? this.defaultGatewayConfigHint(configDir),
    };
  }

  private unsupportedReason(cliHits: string[]): OpenShellUnsupportedReason | undefined {
    if (this.nonEmpty(this.env.SNAP)) {
      return "snap";
    }
    if (this.nonEmpty(this.env.APPIMAGE)) {
      // The bundled aac lives on an ephemeral mount, so it can't be a gateway `command`.
      return "appImage";
    }
    if (cliHits.length > 0 && cliHits.every((hit) => hit === SNAP_CLI_PATH)) {
      return "snap";
    }
    return undefined;
  }

  private nonEmpty(value: string | undefined): boolean {
    return value != null && value.length > 0;
  }

  /** `$XDG_CONFIG_HOME/openshell` (absolute only) or `~/.config/openshell`. */
  private clientConfigDir(): string {
    const xdg = this.env.XDG_CONFIG_HOME;
    const base = xdg != null && path.isAbsolute(xdg) ? xdg : path.join(this.homedir, ".config");
    return path.join(base, "openshell");
  }

  private defaultGatewayConfigHint(configDir: string): string {
    return this.platform === "darwin"
      ? "/opt/homebrew/var/openshell/gateway.toml"
      : path.join(configDir, "gateway.toml");
  }

  /** `PATH` (absolute entries only — a relative entry would make detection depend on the
   *  current directory), then `~/.local/bin` and the fixed locations, de-duplicated. */
  private binDirectories(): string[] {
    const fromPath = (this.env.PATH ?? "")
      .split(path.delimiter)
      .filter((dir) => dir.length > 0 && path.isAbsolute(dir));
    const all = [...fromPath, path.join(this.homedir, ".local", "bin"), ...FIXED_BIN_DIRS];
    return [...new Set(all.map((dir) => path.normalize(dir)))];
  }

  private async findAll(directories: string[], executable: string): Promise<string[]> {
    const hits: string[] = [];
    for (const directory of directories) {
      const candidate = path.join(directory, executable);
      if (await this.fsAdapter.exists(candidate)) {
        hits.push(candidate);
      }
    }
    return hits;
  }

  private async firstExisting(candidates: string[]): Promise<string | undefined> {
    for (const candidate of candidates) {
      if (await this.fsAdapter.exists(candidate)) {
        return candidate;
      }
    }
    return undefined;
  }

  private async readGateways(configDir: string): Promise<OpenShellGatewayInfo[]> {
    const activeRaw = await this.fsAdapter.readSmallFile(
      path.join(configDir, "active_gateway"),
      MAX_READ_BYTES,
    );
    const activeName = activeRaw?.trim();

    const names = (await this.fsAdapter.listSubdirectories(path.join(configDir, "gateways")))
      .filter((name) => isOpenShellGatewayName(name))
      .sort();

    const gateways: OpenShellGatewayInfo[] = [];
    for (const name of names) {
      const raw = await this.fsAdapter.readSmallFile(
        path.join(configDir, "gateways", name, "metadata.json"),
        MAX_READ_BYTES,
      );
      const { endpoint, authMode } = this.parseMetadata(raw);
      gateways.push({
        name,
        endpoint,
        authMode,
        active: name === activeName,
        // §M8.15 U12: an unparseable file is treated as unsupported.
        authSupported: isSupportedGatewayAuth(authMode, endpoint),
      });
    }
    return gateways;
  }

  /** Keeps only `gateway_endpoint` and `auth_mode`; anything else in the file is ignored. */
  private parseMetadata(raw: string | null): { endpoint: string; authMode: string } {
    if (raw == null) {
      return { endpoint: "", authMode: "" };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed == null || typeof parsed !== "object") {
        return { endpoint: "", authMode: "" };
      }
      const record = parsed as Record<string, unknown>;
      const endpoint = typeof record.gateway_endpoint === "string" ? record.gateway_endpoint : "";
      const authMode = typeof record.auth_mode === "string" ? record.auth_mode : "";
      return { endpoint: endpoint.slice(0, 256), authMode: authMode.slice(0, 64) };
    } catch {
      return { endpoint: "", authMode: "" };
    }
  }
}
