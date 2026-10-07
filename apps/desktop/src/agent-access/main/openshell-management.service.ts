import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OPENSHELL_DEFAULT_GATEWAY_NAME, OpenShellDetectionResult } from "../models/openshell";
import {
  buildBitwardenReference,
  isOpenShellCpuQuantity,
  isOpenShellDeniedEnvVarName,
  isOpenShellEnvVarName,
  isOpenShellImageReference,
  isOpenShellMemoryQuantity,
  isOpenShellResourceName,
  isValidOpenShellPermission,
  OpenShellAddCredentialRequest,
  OpenShellApplyStatus,
  OpenShellCreatedSandbox,
  OpenShellCreateProfileRequest,
  OpenShellCreateSandboxRequest,
  OpenShellDeleteProfileRequest,
  OpenShellPermissionEndpoint,
  OpenShellManagedBinding,
  OpenShellManagementError,
  OpenShellManagementResult,
  OpenShellProfileCredential,
  OpenShellProfileEndpoint,
  OpenShellProviderProfile,
  OpenShellRemoveCredentialRequest,
  OpenShellSandbox,
  OpenShellSandboxActionRequest,
  OpenShellSandboxCredential,
  OpenShellUpdateProfileRequest,
} from "../models/openshell-management";

import {
  cleanOpenShellLabel,
  cleanOpenShellText,
  OpenShellCredentialRegistryService,
} from "./openshell-credential-registry.service";
import { OpenShellEnabledState } from "./openshell-enabled-state";

const READ_TIMEOUT_MS = 15_000;
const MUTATION_TIMEOUT_MS = 60_000;

const PROVIDER_COUNT_CONCURRENCY = 4;
const MAX_MESSAGE_CHARS = 300;
const MAX_DETAIL_CHARS = 200;
const MAX_PHASE_CHARS = 64;
const MAX_ID_CHARS = 128;
const MAX_NAME_CHARS = 64;
const MAX_CREATED_AT_CHARS = 64;
const MAX_PROFILE_NAME_CHARS = 120;
const MAX_PROFILE_DESCRIPTION_CHARS = 300;
const MAX_HOST_CHARS = 255;
const MAX_PROFILE_BINARIES = 20;
const MAX_PROVIDER_COUNT_SANDBOXES = 50;
const MAX_RESOURCE_NAME_CHARS = 63;
const MAX_PROVIDERS_PER_SANDBOX_CREATE = 16;
const MAX_BINDINGS = 16;
const MAX_STATUS_PROVIDERS = 8;

const FIXED_PATH = "/opt/homebrew/bin:/usr/bin:/bin";

const TIMED_OUT_MESSAGE = "The command timed out; check the sandbox's state before retrying.";
const BUILT_IN_PROFILE_MESSAGE = "Built-in permissions can't be edited or deleted.";
const WRITABLE_BINARY_MESSAGE = "The openshell binary location is writable by other users.";

export interface OpenShellManagementExecResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The program could not be started at all (missing or not executable). */
  spawnFailed?: boolean;
  /** The process was killed because it ran past its timeout. */
  timedOut?: boolean;
}

/** The one filesystem question asked of the `openshell` binary: who can write to it. */
export interface OpenShellManagementFs {
  /** Like `fs.stat` (follows symlinks); throws when the path doesn't exist. */
  stat(filePath: string): Promise<{ mode: number }>;
  /**
   * Writes `content` to a new private file (a fresh `0700` directory, a random name, `wx`, `0600`)
   * and returns its path with a `remove` that deletes the file and its directory. Used for the
   * profile file the CLI reads; it never holds a credential value.
   */
  writeTempFile?(content: string): Promise<{ filePath: string; remove(): Promise<void> }>;
}

const nodeFs: OpenShellManagementFs = {
  stat: (filePath) => fs.stat(filePath),
  async writeTempFile(content) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "bitwarden-openshell-"));
    const filePath = path.join(directory, `profile-${randomBytes(8).toString("hex")}.json`);
    try {
      await fs.writeFile(filePath, content, { mode: 0o600, flag: "wx" });
    } catch (e) {
      await fs.rm(directory, { recursive: true, force: true }).catch((): void => undefined);
      throw e;
    }
    return {
      filePath,
      remove: () => fs.rm(directory, { recursive: true, force: true }),
    };
  },
};

/**
 * Runs one program by absolute path with an explicit argument list: no shell, a fixed `PATH`, and
 * a timeout. Same contract as `OpenShellSetupExec`, plus stderr.
 */
export interface OpenShellManagementExec {
  run(file: string, args: string[], timeoutMs: number): Promise<OpenShellManagementExecResult>;
}

export const nodeExec: OpenShellManagementExec = {
  run(file, args, timeoutMs) {
    return new Promise((resolve) => {
      execFile(
        file,
        args,
        {
          timeout: timeoutMs,
          killSignal: "SIGKILL",
          env: { PATH: FIXED_PATH, HOME: os.homedir() },
          maxBuffer: 4 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error == null) {
            resolve({ code: 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
            return;
          }
          const e = error as NodeJS.ErrnoException & { killed?: boolean };
          const timedOut = e.killed === true && e.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
          if (e.code === "ENOENT" || e.code === "EACCES") {
            resolve({ code: 127, stdout: "", stderr: "", spawnFailed: true });
            return;
          }
          resolve({
            code: typeof e.code === "number" ? e.code : 1,
            stdout: String(stdout ?? ""),
            stderr: timedOut ? "timed out" : String(stderr ?? ""),
            ...(timedOut ? { timedOut: true } : {}),
          });
        },
      );
    });
  },
};

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; error: OpenShellManagementError; message?: string };

/**
 * A type guard rather than `!result.ok`: this client builds with `strict: false`, where TypeScript
 * does not narrow a union on a boolean field, so `if (isFail(r)) return r` would not compile. A guard
 * narrows in both modes.
 */
function isFail<T>(result: Ok<T> | Fail): result is Fail {
  return !result.ok;
}

const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const fail = (error: OpenShellManagementError, message?: string): Fail =>
  message != null && message !== "" ? { ok: false, error, message } : { ok: false, error };

/** Collapses control characters and whitespace runs into single spaces. */
function oneLine(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, " ").trim();
}

/**
 * Makes CLI stderr safe to show or log: any `bw://` reference, any run of 20 or more token-like
 * characters, any long hex run and any run of 12 or more non-space characters that mixes letters
 * and digits is replaced with `[removed]`, then the line is truncated.
 */
export function scrubOpenShellMessage(text: string, maxChars: number = MAX_MESSAGE_CHARS): string {
  return oneLine(text)
    .replace(/bw:\/\/\S*/gi, "[removed]")
    .replace(/[A-Za-z0-9_\-+/=.~]{20,}/g, "[removed]")
    .replace(/[0-9A-Fa-f]{16,}/g, "[removed]")
    .replace(/\S{12,}/g, (run) => (/[A-Za-z]/.test(run) && /[0-9]/.test(run) ? "[removed]" : run))
    .slice(0, maxChars);
}

/** `value` capped at `max` characters (truncated, never rejected). */
function cap(value: string, max: number): string {
  return value.slice(0, max);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

interface ParsedProvider {
  name: string;
  type: string | null;
}

/** U14: shape unverified. A bare name or an object with `name` and optional `type`/`profile`. */
function parseProviderList(stdout: string): ParsedProvider[] | null {
  const parsed = parseJson(stdout);
  const list = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.providers)
      ? parsed.providers
      : null;
  if (list == null) {
    return null;
  }
  const providers: ParsedProvider[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      providers.push({ name: item, type: null });
    } else if (isPlainObject(item) && typeof item.name === "string") {
      providers.push({
        name: item.name,
        type:
          asString(item.type) ??
          asString(item.profile) ??
          asString(item.provider_type) ??
          asString(item.profile_id),
      });
    }
  }
  return providers;
}

function parseSandboxes(stdout: string): OpenShellSandbox[] | null {
  const parsed = parseJson(stdout);
  const list = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.sandboxes)
      ? parsed.sandboxes
      : null;
  if (list == null) {
    return null;
  }
  const sandboxes: OpenShellSandbox[] = [];
  for (const item of list) {
    if (!isPlainObject(item) || typeof item.name !== "string") {
      continue;
    }
    const created = item.created_at;
    sandboxes.push({
      name: cap(item.name, MAX_NAME_CHARS),
      id: cap(asString(item.id) ?? "", MAX_ID_CHARS),
      phase: cap(asString(item.phase) ?? "", MAX_PHASE_CHARS),
      createdAt: cap(
        typeof created === "string" || typeof created === "number" ? String(created) : "",
        MAX_CREATED_AT_CHARS,
      ),
      providerCount: null,
    });
  }
  return sandboxes;
}

function parseProfiles(stdout: string): OpenShellProviderProfile[] | null {
  const parsed = parseJson(stdout);
  const list = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.profiles)
      ? parsed.profiles
      : null;
  if (list == null) {
    return null;
  }
  const profiles: OpenShellProviderProfile[] = [];
  for (const item of list) {
    if (!isPlainObject(item) || !isOpenShellResourceName(item.id)) {
      continue;
    }
    const credentials: OpenShellProfileCredential[] = [];
    for (const credential of Array.isArray(item.credentials) ? item.credentials : []) {
      if (!isPlainObject(credential) || typeof credential.name !== "string") {
        continue;
      }
      credentials.push({
        name: credential.name,
        description: cap(asString(credential.description) ?? "", MAX_PROFILE_DESCRIPTION_CHARS),
        envVars: (Array.isArray(credential.env_vars) ? credential.env_vars : []).filter(
          (envVar): envVar is string => isOpenShellEnvVarName(envVar),
        ),
        required: credential.required === true,
      });
    }
    const endpoints: OpenShellProfileEndpoint[] = [];
    for (const endpoint of Array.isArray(item.endpoints) ? item.endpoints : []) {
      if (
        isPlainObject(endpoint) &&
        typeof endpoint.host === "string" &&
        typeof endpoint.port === "number"
      ) {
        const access = asString(endpoint.access);
        endpoints.push({
          host: cap(endpoint.host, MAX_HOST_CHARS),
          port: endpoint.port,
          ...(access ? { access: cap(access, MAX_PROFILE_NAME_CHARS) } : {}),
        });
      }
    }
    const binaries = (Array.isArray(item.binaries) ? item.binaries : [])
      .filter((binary): binary is string => typeof binary === "string" && binary !== "")
      .slice(0, MAX_PROFILE_BINARIES)
      .map((binary) => cap(binary, MAX_HOST_CHARS));
    profiles.push({
      id: item.id,
      displayName: cap(asString(item.display_name) ?? item.id, MAX_PROFILE_NAME_CHARS),
      description: cap(asString(item.description) ?? "", MAX_PROFILE_DESCRIPTION_CHARS),
      credentials,
      endpoints,
      binaries,
      editable: item.source === "user",
    });
  }
  return profiles;
}

/** Whether one `sandbox provider status` output says the change was applied. Defensive: the
 *  output shape is unverified. */
function interpretStatus(stdout: string): OpenShellApplyStatus {
  const parsed = parseJson(stdout);
  let detail = "";
  if (isPlainObject(parsed)) {
    for (const key of ["applied", "synced", "in_sync"]) {
      if (typeof parsed[key] === "boolean") {
        const text = asString(parsed.message) ?? asString(parsed.detail) ?? asString(parsed.status);
        return {
          applied: parsed[key] as boolean,
          detail: scrubOpenShellMessage(text ?? stdout, MAX_DETAIL_CHARS),
        };
      }
    }
    detail = asString(parsed.status) ?? asString(parsed.state) ?? asString(parsed.message) ?? "";
  }
  const text = (detail !== "" ? detail : oneLine(stdout)).trim();
  const lowered = text.toLowerCase();
  const negative =
    /not (yet )?(applied|synced|ready)|pending|waiting|in progress|failed|error/.test(lowered);
  const positive = /\bapplied\b|in sync|up to date|\bready\b|complete/.test(lowered);
  return { applied: positive && !negative, detail: scrubOpenShellMessage(text, MAX_DETAIL_CHARS) };
}

export function mapFailure(result: OpenShellManagementExecResult, mutation: boolean): Fail {
  if (result.spawnFailed === true) {
    return fail("cliMissing");
  }
  if (result.timedOut === true && mutation) {
    // The command may have taken effect: this is not evidence the gateway is down.
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
  } else if (/already exists|alreadyexists|already in use|name is taken/.test(lowered)) {
    error = "alreadyExists";
  } else if (/not found|notfound|no such|does not exist/.test(lowered)) {
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

/** The validated, normalized editable part of a permission (hosts lowercased, duplicates dropped). */
interface NormalizedPermission {
  endpoints: OpenShellPermissionEndpoint[];
  binaries: string[];
}

/**
 * `null` for anything the contract validators reject, and for the same host and port given twice
 * with different access (silently picking one could widen it). Only host, port and access are
 * copied, so no other field of a request reaches the profile file.
 */
function normalizePermission(endpoints: unknown, binaries: unknown): NormalizedPermission | null {
  if (!isValidOpenShellPermission(endpoints, binaries)) {
    return null;
  }
  const seen = new Map<string, OpenShellPermissionEndpoint>();
  for (const endpoint of endpoints) {
    const host = endpoint.host.toLowerCase();
    const key = `${host}:${endpoint.port}`;
    const previous = seen.get(key);
    if (previous != null) {
      if (previous.access !== endpoint.access) {
        return null;
      }
      continue;
    }
    seen.set(key, { host, port: endpoint.port, access: endpoint.access });
  }
  return { endpoints: [...seen.values()], binaries: [...new Set(binaries as string[])] };
}

/**
 * The exported profile with only the editable parts replaced. An endpoint that already exists
 * (same host and port) keeps every other field it has (protocol, enforcement, TLS, ...); a new
 * one gets `rest` / `enforce`. Every other top-level field, `resource_version` included, is kept.
 */
function mergeProfile(
  existing: Record<string, unknown>,
  edit: NormalizedPermission & { displayName: string; description: string },
): Record<string, unknown> {
  const current = Array.isArray(existing.endpoints) ? existing.endpoints : [];
  const endpoints = edit.endpoints.map((endpoint) => {
    const match = current.find(
      (candidate) =>
        isPlainObject(candidate) &&
        typeof candidate.host === "string" &&
        candidate.host.toLowerCase() === endpoint.host &&
        candidate.port === endpoint.port,
    );
    return isPlainObject(match)
      ? { ...match, access: endpoint.access }
      : {
          host: endpoint.host,
          port: endpoint.port,
          protocol: "rest",
          access: endpoint.access,
          enforcement: "enforce",
        };
  });
  return {
    ...existing,
    display_name: edit.displayName,
    description: edit.description,
    endpoints,
    binaries: edit.binaries,
  };
}

/** The reasons a request is rejected before any process starts. */
const INVALID = fail("invalidInput");

/**
 * Management of OpenShell sandboxes and their per-sandbox credentials (agent-access-architecture.md,
 * §M8.20). Everything that runs is built here, never by the renderer: every string is validated
 * with the contract validators, argument lists are arrays (no shell), `openshell` is run by the
 * absolute path detection found, and the gateway is always named explicitly.
 *
 * No credential value is ever read, logged or returned. The only secret-adjacent text handled is
 * the `bw://` reference passed to `provider create`, and it is removed from anything echoed back.
 * Every public method resolves to a result; none throws.
 */
export class OpenShellManagementService {
  constructor(
    private logService: LogService,
    private detect: () => Promise<OpenShellDetectionResult>,
    private registry: OpenShellCredentialRegistryService,
    private isAvailable: () => Promise<boolean>,
    private exec: OpenShellManagementExec = nodeExec,
    private fsAdapter: OpenShellManagementFs = nodeFs,
    private enabledState: OpenShellEnabledState = new OpenShellEnabledState(),
  ) {}

  async listSandboxes(): Promise<OpenShellManagementResult<OpenShellSandbox[]>> {
    return this.guarded(async () => {
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const listed = await this.run(target.data, ["sandbox", "list"], [], [], true);
      if (isFail(listed)) {
        return listed;
      }
      const sandboxes = parseSandboxes(listed.data);
      if (sandboxes == null) {
        return fail("failed", "Unexpected output from sandbox list.");
      }

      // Bounded: a gateway with hundreds of sandboxes costs at most 50 extra commands.
      const counted = sandboxes.slice(0, MAX_PROVIDER_COUNT_SANDBOXES);
      let next = 0;
      const worker = async () => {
        while (next < counted.length) {
          const sandbox = counted[next++];
          if (!isOpenShellResourceName(sandbox.name)) {
            continue;
          }
          const providers = await this.run(
            target.data,
            ["sandbox", "provider", "list"],
            [],
            [sandbox.name],
            true,
          );
          const parsed = !isFail(providers) ? parseProviderList(providers.data) : null;
          sandbox.providerCount = parsed == null ? null : parsed.length;
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(PROVIDER_COUNT_CONCURRENCY, counted.length) }, worker),
      );
      return ok(sandboxes);
    });
  }

  async sandboxAction(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (
        !isPlainObject(request) ||
        (request.action !== "start" && request.action !== "stop" && request.action !== "delete") ||
        !isOpenShellResourceName(request.name)
      ) {
        return INVALID;
      }
      const { action, name } = request as unknown as OpenShellSandboxActionRequest;
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const result = await this.run(target.data, ["sandbox", action], [], [name], false);
      if (isFail(result)) {
        return result;
      }
      if (action === "delete") {
        await this.registry.removeSandbox(target.data.gateway, name);
      }
      return ok(undefined);
    });
  }

  async createSandbox(
    request: unknown,
  ): Promise<OpenShellManagementResult<OpenShellCreatedSandbox>> {
    return this.guarded(async () => {
      if (!isPlainObject(request)) {
        return INVALID;
      }
      const { name, from, template, cpu, memory, providerNames } =
        request as OpenShellCreateSandboxRequest;
      if (name != null && !isOpenShellResourceName(name)) {
        return INVALID;
      }
      if (from != null && template != null) {
        return INVALID;
      }
      if (from != null && !isOpenShellImageReference(from)) {
        return INVALID;
      }
      if (template != null && !isOpenShellResourceName(template)) {
        return INVALID;
      }
      if (cpu != null && !isOpenShellCpuQuantity(cpu)) {
        return INVALID;
      }
      if (memory != null && !isOpenShellMemoryQuantity(memory)) {
        return INVALID;
      }
      if (
        providerNames != null &&
        (!Array.isArray(providerNames) ||
          providerNames.length > MAX_PROVIDERS_PER_SANDBOX_CREATE ||
          !providerNames.every((providerName) => isOpenShellResourceName(providerName)))
      ) {
        return INVALID;
      }

      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const flags = [
        ...(name != null ? [`--name=${name}`] : []),
        ...(from != null ? [`--from=${from}`] : []),
        ...(template != null ? [`--template=${template}`] : []),
        ...(cpu != null ? [`--cpu=${cpu}`] : []),
        ...(memory != null ? [`--memory=${memory}`] : []),
        ...(providerNames ?? []).map((providerName) => `--provider=${providerName}`),
        // Without a command the CLI would open an interactive shell and wait for it.
        "--detach",
      ];
      const created = await this.run(target.data, ["sandbox", "create"], flags, [], true, true);
      if (isFail(created)) {
        return created;
      }
      const parsed = parseJson(created.data);
      const parsedName = isPlainObject(parsed)
        ? (asString(parsed.name) ??
          (isPlainObject(parsed.sandbox) ? asString(parsed.sandbox.name) : null))
        : null;
      const resolved =
        parsedName != null && isOpenShellResourceName(parsedName) ? parsedName : name;
      if (resolved == null) {
        return fail("failed", "The sandbox was created but its name could not be read.");
      }
      return ok({ name: resolved });
    });
  }

  async listProfiles(): Promise<OpenShellManagementResult<OpenShellProviderProfile[]>> {
    return this.guarded(async () => {
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const listed = await this.run(target.data, ["provider", "list-profiles"], [], [], true);
      if (isFail(listed)) {
        return listed;
      }
      const profiles = parseProfiles(listed.data);
      return profiles == null
        ? fail("failed", "Unexpected output from list-profiles.")
        : ok(profiles);
    });
  }

  /**
   * Creates a custom permission (a provider profile) with one bearer-token credential. Profiles are
   * gateway-wide. The id must not exist yet: `profile import` would otherwise replace it.
   */
  async createProfile(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (!isPlainObject(request)) {
        return INVALID;
      }
      const { id, displayName, description, credentialEnvVar, endpoints, binaries } =
        request as unknown as OpenShellCreateProfileRequest;
      const permission = normalizePermission(endpoints, binaries);
      if (
        !isOpenShellResourceName(id) ||
        typeof displayName !== "string" ||
        typeof description !== "string" ||
        !isOpenShellEnvVarName(credentialEnvVar) ||
        isOpenShellDeniedEnvVarName(credentialEnvVar) ||
        permission == null
      ) {
        return INVALID;
      }
      const name = cleanOpenShellText(displayName, MAX_PROFILE_NAME_CHARS);
      if (name === "") {
        return INVALID;
      }

      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const listed = await this.run(target.data, ["provider", "list-profiles"], [], [], true);
      if (isFail(listed)) {
        return listed;
      }
      const existing = parseProfiles(listed.data);
      if (existing == null) {
        return fail("failed", "Unexpected output from list-profiles.");
      }
      if (existing.some((profile) => profile.id === id)) {
        return fail("alreadyExists");
      }

      const profile = {
        id,
        display_name: name,
        description: cleanOpenShellText(description, MAX_PROFILE_DESCRIPTION_CHARS),
        category: "other",
        credentials: [
          {
            name: "api_token",
            description: "",
            env_vars: [credentialEnvVar],
            required: true,
            auth_style: "bearer",
            header_name: "authorization",
            query_param: "",
          },
        ],
        endpoints: permission.endpoints.map((endpoint) => ({
          host: endpoint.host,
          port: endpoint.port,
          protocol: "rest",
          access: endpoint.access,
          enforcement: "enforce",
        })),
        binaries: permission.binaries,
        inference_capable: false,
      };
      // Platform scope, like the profiles `list-profiles` already shows.
      return this.applyProfileFile(target.data, "import", profile, null, true);
    });
  }

  /**
   * Changes the name, description, hosts and programs of a custom permission. Profiles are
   * gateway-wide: every sandbox using this one is affected. A built-in profile is refused. The
   * renderer confirms any widening; nothing here second-guesses it beyond the validators.
   */
  async updateProfile(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (!isPlainObject(request)) {
        return INVALID;
      }
      const { id, displayName, description, endpoints, binaries } =
        request as unknown as OpenShellUpdateProfileRequest;
      const permission = normalizePermission(endpoints, binaries);
      if (
        !isOpenShellResourceName(id) ||
        typeof displayName !== "string" ||
        typeof description !== "string" ||
        permission == null
      ) {
        return INVALID;
      }
      const name = cleanOpenShellText(displayName, MAX_PROFILE_NAME_CHARS);
      if (name === "") {
        return INVALID;
      }

      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const exported = await this.exportUserProfile(target.data, id);
      if (isFail(exported)) {
        return exported;
      }
      const merged = mergeProfile(exported.data, {
        ...permission,
        displayName: name,
        description: cleanOpenShellText(description, MAX_PROFILE_DESCRIPTION_CHARS),
      });
      return this.applyProfileFile(
        target.data,
        "update",
        merged,
        id,
        exported.data.scope === "platform",
      );
    });
  }

  /** Deletes a custom permission. A built-in profile is refused; the gateway refuses one in use. */
  async deleteProfile(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (!isPlainObject(request) || !isOpenShellResourceName(request.id)) {
        return INVALID;
      }
      const { id } = request as unknown as OpenShellDeleteProfileRequest;
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const exported = await this.exportUserProfile(target.data, id);
      if (isFail(exported)) {
        return exported;
      }
      const deleted = await this.run(
        target.data,
        ["provider", "profile", "delete"],
        exported.data.scope === "platform" ? ["--global"] : [],
        [id],
        false,
      );
      return isFail(deleted) ? deleted : ok(undefined);
    });
  }

  async listCredentials(
    request: unknown,
  ): Promise<OpenShellManagementResult<OpenShellSandboxCredential[]>> {
    return this.guarded(async () => {
      if (!isPlainObject(request) || !isOpenShellResourceName(request.sandboxName)) {
        return INVALID;
      }
      const sandboxName = request.sandboxName;
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const listed = await this.run(
        target.data,
        ["sandbox", "provider", "list"],
        [],
        [sandboxName],
        true,
      );
      if (isFail(listed)) {
        return listed;
      }
      const providers = parseProviderList(listed.data);
      if (providers == null) {
        return fail("failed", "Unexpected output from sandbox provider list.");
      }
      const entries = await this.registry.getForSandbox(target.data.gateway, sandboxName);
      return ok(
        providers.map((provider): OpenShellSandboxCredential => {
          const entry = entries.find((candidate) => candidate.providerName === provider.name);
          return {
            providerName: provider.name,
            profileId: provider.type ?? entry?.profileId ?? null,
            bindings: entry?.bindings ?? [],
            managed: entry != null,
          };
        }),
      );
    });
  }

  async addCredential(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (!isPlainObject(request)) {
        return INVALID;
      }
      const { sandboxName, profileId, providerName, bindings } =
        request as unknown as OpenShellAddCredentialRequest;
      if (!isOpenShellResourceName(sandboxName) || !isOpenShellResourceName(profileId)) {
        return INVALID;
      }
      const provider =
        providerName != null
          ? providerName
          : `${profileId}-${sandboxName}`.slice(0, MAX_RESOURCE_NAME_CHARS);
      if (!isOpenShellResourceName(provider)) {
        return INVALID;
      }
      if (!Array.isArray(bindings) || bindings.length < 1 || bindings.length > MAX_BINDINGS) {
        return INVALID;
      }

      const managed: OpenShellManagedBinding[] = [];
      const credentialFlags: string[] = [];
      for (const binding of bindings) {
        if (
          !isPlainObject(binding) ||
          !isOpenShellEnvVarName(binding.envVar) ||
          isOpenShellDeniedEnvVarName(binding.envVar)
        ) {
          return INVALID;
        }
        if (typeof binding.label !== "string") {
          return INVALID;
        }
        const clean = {
          envVar: binding.envVar,
          resourceType: binding.resourceType,
          id: binding.id,
          field: binding.field,
        } as OpenShellManagedBinding;
        const reference = buildBitwardenReference(clean);
        if (reference == null || managed.some((existing) => existing.envVar === clean.envVar)) {
          return INVALID;
        }
        managed.push({
          ...clean,
          label: cleanOpenShellLabel(binding.label),
        });
        credentialFlags.push(`--credential=${clean.envVar}=${reference}`);
      }

      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      // The profile must exist, and each env var must be one its credentials declare.
      const listedProfiles = await this.run(
        target.data,
        ["provider", "list-profiles"],
        [],
        [],
        true,
      );
      if (isFail(listedProfiles)) {
        return listedProfiles;
      }
      const profiles = parseProfiles(listedProfiles.data);
      if (profiles == null) {
        return fail("failed", "Unexpected output from list-profiles.");
      }
      const profile = profiles.find((candidate) => candidate.id === profileId);
      if (profile == null) {
        return INVALID;
      }
      const declared = new Set(profile.credentials.flatMap((credential) => credential.envVars));
      if (!managed.every((binding) => declared.has(binding.envVar))) {
        return INVALID;
      }

      const created = await this.run(
        target.data,
        ["provider", "create"],
        [`--name=${provider}`, `--type=${profileId}`, ...credentialFlags],
        [],
        false,
      );
      if (isFail(created)) {
        return created;
      }

      const attached = await this.run(
        target.data,
        ["sandbox", "provider", "attach"],
        [],
        [sandboxName, provider],
        false,
      );
      if (isFail(attached)) {
        // Roll back so a failed attach doesn't leave an orphan provider that blocks a retry.
        const rolledBack = await this.run(
          target.data,
          ["provider", "delete"],
          [],
          [provider],
          false,
        );
        if (isFail(rolledBack)) {
          this.logService.warning(
            `[Agent Access] OpenShell could not roll back provider ${provider} after a failed attach.`,
          );
        }
        return fail("failed", attached.message);
      }

      const saved = await this.registry.upsert({
        gatewayName: target.data.gateway,
        sandboxName,
        providerName: provider,
        profileId,
        bindings: managed,
        createdAtMs: Date.now(),
      });
      if (!saved) {
        this.logService.warning(
          `[Agent Access] OpenShell credential ${provider} was attached but could not be recorded.`,
        );
      }
      return ok(undefined);
    });
  }

  async removeCredential(request: unknown): Promise<OpenShellManagementResult<void>> {
    return this.guarded(async () => {
      if (
        !isPlainObject(request) ||
        !isOpenShellResourceName(request.sandboxName) ||
        !isOpenShellResourceName(request.providerName) ||
        typeof request.deleteProvider !== "boolean"
      ) {
        return INVALID;
      }
      const { sandboxName, providerName, deleteProvider } =
        request as unknown as OpenShellRemoveCredentialRequest;
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      const { gateway } = target.data;
      if (deleteProvider && !(await this.registry.isManaged(gateway, sandboxName, providerName))) {
        // A provider this app didn't create, or created on another gateway, is never deleted by it.
        return INVALID;
      }
      const detached = await this.run(
        target.data,
        ["sandbox", "provider", "detach"],
        [],
        [sandboxName, providerName],
        false,
      );
      if (isFail(detached)) {
        return detached;
      }
      // A provider can be attached to several sandboxes. Delete it only when no other sandbox on
      // this gateway uses it; when that can't be confirmed, only detach (the UI explains a kept
      // provider).
      if (
        deleteProvider &&
        (await this.isUnusedElsewhere(target.data, sandboxName, providerName))
      ) {
        const deleted = await this.run(
          target.data,
          ["provider", "delete"],
          [],
          [providerName],
          false,
        );
        if (isFail(deleted)) {
          // The provider still exists and is still ours: keep its record.
          return deleted;
        }
      }
      await this.registry.removeProvider(gateway, sandboxName, providerName);
      return ok(undefined);
    });
  }

  async getApplyStatus(request: unknown): Promise<OpenShellManagementResult<OpenShellApplyStatus>> {
    return this.guarded(async () => {
      if (!isPlainObject(request) || !isOpenShellResourceName(request.sandboxName)) {
        return INVALID;
      }
      const sandboxName = request.sandboxName;
      const target = await this.target();
      if (isFail(target)) {
        return target;
      }
      // The CLI reports status per provider, so ask for each attached one.
      const listed = await this.run(
        target.data,
        ["sandbox", "provider", "list"],
        [],
        [sandboxName],
        true,
      );
      if (isFail(listed)) {
        return listed;
      }
      const providers = parseProviderList(listed.data);
      if (providers == null) {
        return fail("failed", "Unexpected output from sandbox provider list.");
      }
      const names = providers
        .map((provider) => provider.name)
        .filter((providerName) => isOpenShellResourceName(providerName))
        .slice(0, MAX_STATUS_PROVIDERS);
      if (names.length === 0) {
        return ok({ applied: true, detail: "" });
      }
      const statuses: OpenShellApplyStatus[] = [];
      for (const providerName of names) {
        const status = await this.run(
          target.data,
          ["sandbox", "provider", "status"],
          [],
          [sandboxName, providerName],
          true,
        );
        if (isFail(status)) {
          return status;
        }
        statuses.push(interpretStatus(status.data));
      }
      return ok({
        applied: statuses.every((status) => status.applied),
        detail: statuses
          .map((status) => status.detail)
          .filter((detail) => detail !== "")
          .join("; ")
          .slice(0, MAX_DETAIL_CHARS),
      });
    });
  }

  /** `true` only when every other sandbox on the gateway was checked and none has the provider. */
  private async isUnusedElsewhere(
    target: { cliPath: string; gateway: string },
    sandboxName: string,
    providerName: string,
  ): Promise<boolean> {
    const listed = await this.run(target, ["sandbox", "list"], [], [], true);
    if (isFail(listed)) {
      return false;
    }
    const sandboxes = parseSandboxes(listed.data);
    if (sandboxes == null || sandboxes.length > MAX_PROVIDER_COUNT_SANDBOXES) {
      return false;
    }
    const others = sandboxes.filter((sandbox) => sandbox.name !== sandboxName);
    if (others.some((sandbox) => !isOpenShellResourceName(sandbox.name))) {
      return false;
    }
    let unused = true;
    let next = 0;
    const worker = async () => {
      while (unused && next < others.length) {
        const sandbox = others[next++];
        const providers = await this.run(
          target,
          ["sandbox", "provider", "list"],
          [],
          [sandbox.name],
          true,
        );
        const parsed = !isFail(providers) ? parseProviderList(providers.data) : null;
        if (parsed == null || parsed.some((provider) => provider.name === providerName)) {
          unused = false;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(PROVIDER_COUNT_CONCURRENCY, others.length) }, worker),
    );
    return unused;
  }

  /** `profile export` for one id, refused unless it is a custom (`source: user`) profile. */
  private async exportUserProfile(
    target: { cliPath: string; gateway: string },
    id: string,
  ): Promise<Ok<Record<string, unknown>> | Fail> {
    const exported = await this.run(target, ["provider", "profile", "export"], [], [id], true);
    if (isFail(exported)) {
      return exported;
    }
    const parsed = parseJson(exported.data);
    if (!isPlainObject(parsed) || parsed.id !== id) {
      return fail("failed", "Unexpected output from profile export.");
    }
    if (parsed.source !== "user") {
      return fail("unsupported", BUILT_IN_PROFILE_MESSAGE);
    }
    return ok(parsed);
  }

  /**
   * Writes `profile` to a private temp file, lints it (a new profile only: `lint` rejects an
   * existing id), then runs `profile update <id>` or `profile import` on it. The file is always removed, whatever happens. A lint rejection is
   * reported as invalid input, with the CLI's own (scrubbed) reason.
   */
  private async applyProfileFile(
    target: { cliPath: string; gateway: string },
    mode: "update" | "import",
    profile: Record<string, unknown>,
    id: string | null,
    global: boolean,
  ): Promise<Ok<void> | Fail> {
    const write = this.fsAdapter.writeTempFile ?? nodeFs.writeTempFile;
    let temp: { filePath: string; remove(): Promise<void> };
    try {
      temp = await write.call(this.fsAdapter, JSON.stringify(profile, null, 2));
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell could not write a profile file: ${e}`);
      return fail("failed", "The permission file could not be prepared.");
    }
    try {
      const flags = [`--file=${temp.filePath}`, ...(global ? ["--global"] : [])];
      // `lint` refuses an id that already exists, so it can only check a new profile. An update is
      // checked by our own validators, and the gateway validates it again when it applies it.
      if (mode === "import") {
        const linted = await this.run(
          target,
          ["provider", "profile", "lint"],
          flags,
          [],
          false,
          false,
        );
        if (isFail(linted)) {
          return linted.error === "failed" || linted.error === "notFound"
            ? fail("invalidInput", linted.message)
            : linted;
        }
      }
      const applied = await this.run(
        target,
        ["provider", "profile", mode],
        flags,
        id == null ? [] : [id],
        false,
      );
      return isFail(applied) ? applied : ok(undefined);
    } finally {
      await temp.remove().catch((): void => undefined);
    }
  }

  /** Never lets an unexpected exception cross the IPC boundary. */
  private async guarded<T>(task: () => Promise<OpenShellManagementResult<T>>) {
    try {
      return await task();
    } catch (e) {
      this.logService.warning(`[Agent Access] OpenShell management failed unexpectedly: ${e}`);
      return fail("failed");
    }
  }

  /** The CLI to run and the gateway to name, or why neither is available. */
  private async target(): Promise<Ok<{ cliPath: string; gateway: string }> | Fail> {
    if (!this.enabledState.isEnabled() || !(await this.isAvailable())) {
      // The Agent Access OpenShell toggle must be on (§M8.20 rule 6), not just set up.
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

  /** `false` when the binary is group- or world-writable, or its directory is world-writable. The
   *  directory may be group-writable: Homebrew installs `bin` as `drwxrwxr-x user:admin`, and
   *  refusing that would refuse every stock install. A binary that can't be inspected is reported
   *  as missing by the caller's run, so it is not refused here. */
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

  /**
   * Runs `openshell <command...> --gateway=<name> <flags...> [-o json] <positionals...>`; resolves
   * to stdout on success. `json` adds `-o json`. Mutations get the longer timeout.
   */
  private async run(
    target: { cliPath: string; gateway: string },
    command: string[],
    flags: string[],
    positionals: string[],
    json: boolean,
    mutation: boolean = !json,
  ): Promise<Ok<string> | Fail> {
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
