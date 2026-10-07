import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OPENSHELL_DEFAULT_GATEWAY_NAME, OpenShellDetectionResult } from "../models/openshell";
import {
  isOpenShellPort,
  isOpenShellResourceName,
  OpenShellManagementError,
  OpenShellManagementResult,
} from "../models/openshell-management";
import {
  isOpenShellForwardPort,
  OpenShellForward,
  OpenShellOpenShellResult,
  OpenShellSavedPort,
} from "../models/openshell-ports";

import { OpenShellEnabledState } from "./openshell-enabled-state";
import {
  nodeExec,
  OpenShellManagementExec,
  OpenShellManagementExecResult,
  scrubOpenShellMessage,
} from "./openshell-management.service";
import { OpenShellSavedPortsService } from "./openshell-saved-ports.service";

const READ_TIMEOUT_MS = 15_000;
const MUTATION_TIMEOUT_MS = 60_000;
const OPEN_TIMEOUT_MS = 10_000;
const MAX_FORWARDS = 200;
const MAX_BIND_CHARS = 64;
/** How long the Terminal launch script is kept if it never ran (it deletes itself when it does). */
const SCRIPT_CLEANUP_DELAY_MS = 60_000;
const OPEN_BINARY = "/usr/bin/open";

const TIMED_OUT_MESSAGE = "The command timed out; check the forward's state before retrying.";
const WRITABLE_BINARY_MESSAGE = "The openshell binary location is writable by other users.";
const NO_SANDBOX_FIELD_MESSAGE = "The forward list does not say which sandbox each forward is for.";

/** Filesystem operations of this service: the binary's mode, and the private Terminal script. */
export interface OpenShellPortsFs {
  stat(filePath: string): Promise<{ mode: number }>;
  /**
   * Writes `content` to a new `0700` file in a fresh `0700` directory (random name, `wx`) and
   * returns its path with a `remove` that deletes the file and its directory.
   */
  writeExecutableTempFile(content: string): Promise<{ filePath: string; remove(): Promise<void> }>;
}

const nodeFs: OpenShellPortsFs = {
  stat: (filePath) => fs.stat(filePath),
  async writeExecutableTempFile(content) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "bitwarden-openshell-shell-"));
    await fs.chmod(directory, 0o700);
    const filePath = path.join(directory, `connect-${randomBytes(8).toString("hex")}.command`);
    try {
      await fs.writeFile(filePath, content, { mode: 0o700, flag: "wx" });
      await fs.chmod(filePath, 0o700);
    } catch (e) {
      await fs.rm(directory, { recursive: true, force: true }).catch((): void => undefined);
      throw e;
    }
    return { filePath, remove: () => fs.rm(directory, { recursive: true, force: true }) };
  },
};

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; error: OpenShellManagementError; message?: string };

function isFail<T>(result: Ok<T> | Fail): result is Fail {
  return !result.ok;
}

const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const fail = (error: OpenShellManagementError, message?: string): Fail =>
  message != null && message !== "" ? { ok: false, error, message } : { ok: false, error };

const INVALID = fail("invalidInput");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const SAFE_SHELL_WORD = /^[A-Za-z0-9_@%+=:,./-]+$/;

/** One word for a POSIX shell: left bare when it is plainly safe, otherwise single-quoted. */
export function quoteShellWord(word: string): string {
  return SAFE_SHELL_WORD.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/** Whether the `forward list` text means "nothing is forwarded" (the CLI prints prose, not `[]`,
 *  for the table format; JSON gives `[]`). */
function isEmptyForwardOutput(stdout: string): boolean {
  const text = stdout.trim();
  return text === "" || /^no (active )?(port )?forwards?\b/i.test(text);
}

function firstString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (typeof item[key] === "string") {
      return item[key] as string;
    }
  }
  return null;
}

function firstNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && /^[0-9]{1,5}$/.test(value)) {
      return Number(value);
    }
  }
  return null;
}

/**
 * The `forward list -o json` output: a list, or an object with the list under `forwards`. The shape
 * of a non-empty list is unverified (the dev gateway had none): every field is looked up under a
 * few likely names, an item without a sandbox name and a valid port is dropped, and an output that
 * isn't a list is `null` (a failure, not an empty list). A `[bind:]port` string is also accepted.
 */
function parseForwards(stdout: string): OpenShellForward[] | null {
  if (isEmptyForwardOutput(stdout)) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  const list = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.forwards)
      ? parsed.forwards
      : null;
  if (list == null) {
    return null;
  }
  const forwards: OpenShellForward[] = [];
  for (const item of list.slice(0, MAX_FORWARDS)) {
    if (!isPlainObject(item)) {
      continue;
    }
    let bindAddress = firstString(item, ["bind_address", "bind", "address", "host"]) ?? "";
    let port = firstNumber(item, ["port", "local_port", "localPort"]);
    if (port == null) {
      // `127.0.0.1:8080` or `8080`.
      const spec = firstString(item, ["local", "listen"]);
      const match = spec == null ? null : /^(?:(.*):)?([0-9]{1,5})$/.exec(spec);
      if (match != null) {
        port = Number(match[2]);
        bindAddress = bindAddress || (match[1] ?? "");
      }
    }
    const sandbox = firstString(item, ["sandbox", "sandbox_name", "name"]);
    if (!isOpenShellForwardPort(port)) {
      continue;
    }
    forwards.push({
      sandboxName: sandbox ?? "",
      port,
      bindAddress: scrubBind(bindAddress),
      pid: firstNumber(item, ["pid"]),
    });
  }
  return forwards;
}

function scrubBind(value: string): string {
  return value.replace(/[^ -~]/g, "").slice(0, MAX_BIND_CHARS);
}

function mapFailure(result: OpenShellManagementExecResult, mutation: boolean): Fail {
  if (result.spawnFailed === true) {
    return fail("cliMissing");
  }
  if (result.timedOut === true && mutation) {
    return fail("failed", TIMED_OUT_MESSAGE);
  }
  const message = scrubOpenShellMessage(result.stderr !== "" ? result.stderr : result.stdout);
  const lowered = result.stderr.toLowerCase();
  let error: OpenShellManagementError = "failed";
  if (
    /connection refused|unreachable|could not connect|connect error|transport error|tls|timed out|deadline exceeded|unavailable|no route to host|handshake/.test(
      lowered,
    )
  ) {
    error = "gatewayUnreachable";
  } else if (/already exists|already in use|address in use|already forwarded/.test(lowered)) {
    error = "alreadyExists";
  } else if (/sandbox.*not found|no such sandbox|does not exist/.test(lowered)) {
    error = "notFound";
  } else if (
    /unrecognized (option|subcommand|argument)|unknown (flag|option|subcommand|argument)|unexpected argument|invalid subcommand/.test(
      lowered,
    )
  ) {
    error = "unsupported";
  }
  return fail(error, message);
}

/**
 * Opening a shell in a sandbox and managing its port forwards (§M8.20 rule 15). Everything that
 * runs is built here from validated values: argument arrays only, no shell, `openshell` by the
 * absolute path detection found, the gateway named explicitly. The renderer never sends a path, a
 * command, an address or a URL: only a sandbox name, a port, and a name to remember.
 *
 * Gated like the rest of management (the Agent Access OpenShell toggle must be on). Every public
 * method resolves to a result; none throws.
 */
export class OpenShellPortsService {
  constructor(
    private logService: LogService,
    private detect: () => Promise<OpenShellDetectionResult>,
    private isAvailable: () => Promise<boolean>,
    private savedPorts: OpenShellSavedPortsService,
    private exec: OpenShellManagementExec = nodeExec,
    private fsAdapter: OpenShellPortsFs = nodeFs,
    private enabledState: OpenShellEnabledState = new OpenShellEnabledState(),
    private platform: NodeJS.Platform = process.platform,
  ) {}

  async listForwards(request: unknown): Promise<OpenShellManagementResult<OpenShellForward[]>> {
    return this.guarded(async () => {
      const sandboxName = this.sandboxOf(request);
      if (sandboxName == null) {
        return INVALID;
      }
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const listed = await this.run(target.data, ["forward", "list"], [], [], true);
      if (isFail(listed)) {
        return listed;
      }
      const forwards = parseForwards(listed.data);
      if (forwards == null) {
        return fail("failed", "Unexpected output from forward list.");
      }
      if (forwards.length > 0 && forwards.every((forward) => forward.sandboxName === "")) {
        return fail("failed", NO_SANDBOX_FIELD_MESSAGE);
      }
      return ok(forwards.filter((forward) => forward.sandboxName === sandboxName));
    });
  }

  async startForward(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      const valid = this.sandboxAndPortOf(request);
      if (valid == null) {
        return INVALID;
      }
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      // Always an explicit loopback bind: never a bare port (which the CLI may bind wider) and
      // never an address from the caller.
      const started = await this.run(
        target.data,
        ["forward", "start"],
        ["--background"],
        [`127.0.0.1:${valid.port}`, valid.sandboxName],
        false,
      );
      return isFail(started) ? started : ok(undefined);
    });
  }

  async stopForward(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      const valid = this.sandboxAndPortOf(request);
      if (valid == null) {
        return INVALID;
      }
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const stopped = await this.run(
        target.data,
        ["forward", "stop"],
        [],
        [String(valid.port), valid.sandboxName],
        false,
      );
      return isFail(stopped) ? stopped : ok(undefined);
    });
  }

  /**
   * `copyCommand`: the text of `openshell sandbox connect --gateway=<g> <sandbox>`, nothing run.
   * `openTerminal` (macOS only): the same command in Terminal, through a private self-deleting
   * `.command` script launched with `/usr/bin/open -a Terminal`.
   */
  async openShell(request: unknown): Promise<OpenShellManagementResult<OpenShellOpenShellResult>> {
    return this.guarded(async () => {
      if (
        !isPlainObject(request) ||
        !isOpenShellResourceName(request.sandboxName) ||
        (request.action !== "copyCommand" && request.action !== "openTerminal")
      ) {
        return INVALID;
      }
      const { sandboxName, action } = request as { sandboxName: string; action: string };
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const words = [
        target.data.cliPath,
        "sandbox",
        "connect",
        `--gateway=${target.data.gateway}`,
        sandboxName,
      ];
      const command = words.map(quoteShellWord).join(" ");
      if (action === "copyCommand") {
        return ok({ command, launched: false });
      }
      if (this.platform !== "darwin") {
        return fail("unsupported");
      }
      if (CONTROL_CHARACTERS.test(target.data.cliPath)) {
        return fail("failed", "The openshell path is not usable.");
      }
      return this.launchTerminal(command);
    });
  }

  async getSavedPorts(request: unknown): Promise<OpenShellManagementResult<OpenShellSavedPort[]>> {
    return this.guarded(async () => {
      const sandboxName = this.sandboxOf(request);
      if (sandboxName == null) {
        return INVALID;
      }
      const target = await this.gatewayOnly();
      if (isFail(target)) {
        return target;
      }
      return ok(await this.savedPorts.get(target.data, sandboxName));
    });
  }

  async setSavedPorts(request: unknown): Promise<OpenShellManagementResult<OpenShellSavedPort[]>> {
    return this.guarded(async () => {
      const sandboxName = this.sandboxOf(request);
      if (sandboxName == null || !Array.isArray((request as { ports?: unknown }).ports)) {
        return INVALID;
      }
      const target = await this.gatewayOnly();
      if (isFail(target)) {
        return target;
      }
      const stored = await this.savedPorts.set(
        target.data,
        sandboxName,
        (request as { ports: unknown }).ports,
      );
      return stored == null ? fail("failed", "The saved ports could not be saved.") : ok(stored);
    });
  }

  private async launchTerminal(command: string): Promise<Ok<OpenShellOpenShellResult> | Fail> {
    // The script removes its own directory first, then replaces itself with the command. The
    // timer below only matters when Terminal never ran it.
    const script = [
      "#!/bin/sh",
      'rm -rf -- "$(dirname -- "$0")" 2>/dev/null',
      `exec ${command}`,
      "",
    ].join("\n");
    let temp: { filePath: string; remove(): Promise<void> };
    try {
      temp = await this.fsAdapter.writeExecutableTempFile(script);
    } catch (e) {
      this.logService.warning(
        `[Agent Access] OpenShell Terminal script could not be written: ${e}`,
      );
      return fail("failed");
    }
    const removeQuietly = () => temp.remove().catch((): void => undefined);
    let result: OpenShellManagementExecResult;
    try {
      result = await this.exec.run(OPEN_BINARY, ["-a", "Terminal", temp.filePath], OPEN_TIMEOUT_MS);
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell Terminal could not be launched: ${e}`);
      await removeQuietly();
      return fail("failed");
    }
    if (result.code !== 0 || result.spawnFailed === true) {
      await removeQuietly();
      return fail("failed", "Terminal could not be opened.");
    }
    const timer = setTimeout(() => void removeQuietly(), SCRIPT_CLEANUP_DELAY_MS);
    timer.unref?.();
    return ok({ command, launched: true });
  }

  private sandboxOf(request: unknown): string | null {
    return isPlainObject(request) && isOpenShellResourceName(request.sandboxName)
      ? request.sandboxName
      : null;
  }

  private sandboxAndPortOf(request: unknown): { sandboxName: string; port: number } | null {
    const sandboxName = this.sandboxOf(request);
    const port = (request as { port?: unknown } | null)?.port;
    return sandboxName != null && isOpenShellPort(port) ? { sandboxName, port } : null;
  }

  private async guarded<T>(task: () => Promise<OpenShellManagementResult<T>>) {
    try {
      return await task();
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell ports failed unexpectedly: ${e}`);
      return fail("failed");
    }
  }

  private async gatewayOnly(): Promise<Ok<string> | Fail> {
    const target = await this.target();
    return isFail(target) ? target : ok(target.data.gateway);
  }

  private async target(): Promise<Ok<{ cliPath: string; gateway: string }> | Fail> {
    if (!this.enabledState.isEnabled() || !(await this.isAvailable())) {
      return fail("unsupported");
    }
    const detection = await this.detect();
    if (!detection.present || !detection.platformSupported) {
      return fail("unsupported");
    }
    if (detection.cliPath == null || detection.cliPath === "") {
      return fail("cliMissing");
    }
    const gateway =
      detection.gateways.find((candidate) => candidate.active)?.name ??
      detection.gateways[0]?.name ??
      OPENSHELL_DEFAULT_GATEWAY_NAME;
    if (!isOpenShellResourceName(gateway)) {
      return fail("failed", "The active gateway name is not usable.");
    }
    if (!(await this.isBinaryLocationSafe(detection.cliPath))) {
      return fail("failed", WRITABLE_BINARY_MESSAGE);
    }
    return ok({ cliPath: detection.cliPath, gateway });
  }

  private async isBinaryLocationSafe(cliPath: string): Promise<boolean> {
    const checks: Array<[string, number]> = [
      [cliPath, 0o022],
      [path.dirname(cliPath), 0o002],
    ];
    for (const [candidate, unsafeBits] of checks) {
      try {
        if (((await this.fsAdapter.stat(candidate)).mode & unsafeBits) !== 0) {
          return false;
        }
      } catch {
        // Missing: the exec reports it as `cliMissing`.
      }
    }
    return true;
  }

  private async run(
    target: { cliPath: string; gateway: string },
    command: string[],
    flags: string[],
    positionals: string[],
    json: boolean,
  ): Promise<Ok<string> | Fail> {
    const mutation = !json;
    const args = [
      ...command,
      `--gateway=${target.gateway}`,
      ...flags,
      ...(json ? ["-o", "json"] : []),
      ...positionals,
    ];
    let result: OpenShellManagementExecResult;
    try {
      result = await this.exec.run(
        target.cliPath,
        args,
        mutation ? MUTATION_TIMEOUT_MS : READ_TIMEOUT_MS,
      );
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell command could not be run: ${e}`);
      return fail("failed");
    }
    if (result.code !== 0 || result.spawnFailed === true) {
      const failure = mapFailure(result, mutation);
      this.logService.warning(
        `[Agent Access] OpenShell ${command.join(" ")} failed (${failure.error}): ${failure.message ?? ""}`,
      );
      return failure;
    }
    return ok(result.stdout);
  }
}
