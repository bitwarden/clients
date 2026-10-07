/**
 * Shared contract for the OpenShell management page (agent-access-architecture.md, §M8.20).
 *
 * BINDING. The main-process service, the IPC/preload layer and every renderer component are built
 * against this file. Do not change it in passing; if it is wrong, say so and the owner updates it
 * and §M8.20 together.
 *
 * Plain data and pure validators only, so main and renderer can both import it. Nothing here ever
 * holds a credential value: only names, ids, env-var names and references.
 */

// ---------------------------------------------------------------------------------------------
// Validators. Every string that reaches an `openshell` argument list is checked with one of
// these in main, whatever the renderer already checked. All of them reject a leading `-`, so a
// value can never be read as a flag.
// ---------------------------------------------------------------------------------------------

const RESOURCE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const ENV_VAR_NAME = /^[A-Z_][A-Z0-9_]{0,63}$/;
// OCI reference grammar: optional registry `host[:port]/`, lowercase repository path components,
// optional `:tag`, optional `@sha256:<64 hex>`. No leading `/` or `.`, no `..`, no uppercase path.
const IMAGE_HOST_LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?";
const IMAGE_HOST = `${IMAGE_HOST_LABEL}(?:\\.${IMAGE_HOST_LABEL})*(?::[0-9]{1,5})?`;
const IMAGE_COMPONENT = "[a-z0-9]+(?:(?:\\.|_|__|-+)[a-z0-9]+)*";
const IMAGE_TAG = "[A-Za-z0-9_][A-Za-z0-9._-]{0,127}";
const IMAGE_REFERENCE = new RegExp(
  `^(?:${IMAGE_HOST}/)?${IMAGE_COMPONENT}(?:/${IMAGE_COMPONENT})*(?::${IMAGE_TAG})?(?:@sha256:[a-f0-9]{64})?$`,
);
const ARCHIVE_SUFFIX = /\.(?:tar|tgz|tar\.gz)$/i;
const MAX_IMAGE_REFERENCE_CHARS = 254;
const CPU_QUANTITY = /^[0-9]+(\.[0-9]+)?m?$/;
const MEMORY_QUANTITY = /^[0-9]+(\.[0-9]+)?(Ki|Mi|Gi|Ti|K|M|G|T)?$/;
const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A sandbox, provider, template or profile name. */
export function isOpenShellResourceName(value: unknown): value is string {
  return typeof value === "string" && RESOURCE_NAME.test(value);
}

/** An environment-variable name a provider credential is exposed as inside a sandbox. */
export function isOpenShellEnvVarName(value: unknown): value is string {
  return typeof value === "string" && ENV_VAR_NAME.test(value);
}

/**
 * A container image reference (`registry/img:tag`, `img@sha256:…`). Not a path, a rootfs archive or
 * a flag: `..` segments, a leading `/` or `.` and a `.tar`/`.tgz`/`.tar.gz` name are all rejected.
 */
export function isOpenShellImageReference(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_IMAGE_REFERENCE_CHARS) {
    return false;
  }
  if (value.includes("..") || !IMAGE_REFERENCE.test(value)) {
    return false;
  }
  const repository = value.replace(/@sha256:[a-f0-9]{64}$/, "").replace(/:[^:/]*$/, "");
  return !ARCHIVE_SUFFIX.test(value) && !ARCHIVE_SUFFIX.test(repository);
}

const DENIED_ENV_VARS = new Set([
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "NODE_OPTIONS",
  "NODE_PATH",
  "PATH",
  "HOME",
  "SHELL",
  "IFS",
  "BASH_ENV",
  "ENV",
  "PYTHONPATH",
  "PYTHONSTARTUP",
  "RUBYOPT",
  "PERL5OPT",
  "JAVA_TOOL_OPTIONS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
]);

/** Env vars that change how a process loads code or routes traffic: never a credential's name,
 *  even when a profile declares them. Case-insensitive; `DYLD_*` by prefix. */
export function isOpenShellDeniedEnvVarName(value: string): boolean {
  const upper = value.toUpperCase();
  return DENIED_ENV_VARS.has(upper) || upper.startsWith("DYLD_");
}

export function isOpenShellCpuQuantity(value: unknown): value is string {
  return typeof value === "string" && CPU_QUANTITY.test(value);
}

export function isOpenShellMemoryQuantity(value: unknown): value is string {
  return typeof value === "string" && MEMORY_QUANTITY.test(value);
}

/** A vault item or Secrets Manager secret id, as `bw://` references require (lowercase). */
export function isOpenShellVaultId(value: unknown): value is string {
  return typeof value === "string" && LOWERCASE_UUID.test(value);
}

// ---------------------------------------------------------------------------------------------
// The `bw://` reference a provider credential is created with (§M8.3). Built in main only, from
// a validated id; the renderer never sends a reference string.
// ---------------------------------------------------------------------------------------------

export type OpenShellVaultResourceType = "item" | "secret";

/** Which part of the vault object the sandbox receives a placeholder for. */
export type OpenShellVaultField = "username" | "password" | "value";

export interface OpenShellCredentialBinding {
  /** The env var the sandbox sees (a placeholder, never the value). */
  envVar: string;
  resourceType: OpenShellVaultResourceType;
  /** Lowercase vault item or secret UUID. */
  id: string;
  /** `username`/`password` for an item, `value` for a secret. */
  field: OpenShellVaultField;
}

/** `bw://item/<uuid>#username|password` or `bw://secret/<uuid>`; `null` for any invalid input. */
export function buildBitwardenReference(binding: OpenShellCredentialBinding): string | null {
  if (!isOpenShellVaultId(binding.id)) {
    return null;
  }
  if (
    binding.resourceType === "item" &&
    (binding.field === "username" || binding.field === "password")
  ) {
    return `bw://item/${binding.id}#${binding.field}`;
  }
  if (binding.resourceType === "secret" && binding.field === "value") {
    return `bw://secret/${binding.id}`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Result envelope. Every management IPC returns one; main never throws across IPC.
// ---------------------------------------------------------------------------------------------

export type OpenShellManagementError =
  /** No `openshell` binary found (detection's `cliPath`). */
  | "cliMissing"
  /** The CLI ran but could not reach the gateway (connection refused, TLS, timeout). */
  | "gatewayUnreachable"
  /** An argument failed validation in main. No process was started. */
  | "invalidInput"
  /** The named sandbox, provider or profile does not exist. */
  | "notFound"
  /** The name is already taken. */
  | "alreadyExists"
  /** Not supported here: Windows, Snap, AppImage, or OpenShell not enabled in Agent Access. */
  | "unsupported"
  /** Anything else. `message` carries a scrubbed, truncated line of the CLI's stderr. */
  | "failed";

/**
 * The same fields are declared (as optional `undefined`) on both branches. This client builds with
 * `strict: false`, where TypeScript cannot narrow a union on a boolean `ok`, so a consumer that
 * writes `if (!result.ok) { result.error }` would not compile. With both branches carrying every
 * field, that read type-checks with or without narrowing, and narrowing still works under strict.
 */
export type OpenShellManagementResult<T> =
  | { ok: true; data: T; error?: undefined; message?: undefined }
  | {
      ok: false;
      data?: undefined;
      error: OpenShellManagementError;
      /** At most 300 characters of CLI stderr with any `bw://` reference and anything shaped like
       *  a secret removed. Safe to show; never parsed. */
      message?: string;
    };

// ---------------------------------------------------------------------------------------------
// Sandboxes
// ---------------------------------------------------------------------------------------------

/** Gateway-reported, unverified. `phase` is shown as text; only `Ready` and `Stopped` get
 *  dedicated actions (the gateway reports other phases while provisioning or failing). */
export interface OpenShellSandbox {
  name: string;
  id: string;
  /** e.g. `Ready`, `Provisioning`, `Stopped`, `Error`. Free text from the gateway. */
  phase: string;
  /** Gateway timestamp, verbatim. */
  createdAt: string;
  /** Names of providers attached, from `sandbox provider list`. `null` until fetched. */
  providerCount: number | null;
}

export type OpenShellSandboxAction = "start" | "stop" | "delete";

export interface OpenShellSandboxActionRequest {
  action: OpenShellSandboxAction;
  name: string;
}

/** `openshell sandbox create`. Every field optional; names and sizes are validated in main. */
export interface OpenShellCreateSandboxRequest {
  name?: string;
  /** Container image reference. Mutually exclusive with `template`. */
  from?: string;
  /** Named sandbox template. Mutually exclusive with `from`. */
  template?: string;
  /** e.g. `500m`, `2`. */
  cpu?: string;
  /** e.g. `512Mi`, `4Gi`. */
  memory?: string;
  /** Providers to attach at creation. Each must already exist. */
  providerNames?: string[];
}

export interface OpenShellCreatedSandbox {
  /** The name used (the gateway's when none was given). */
  name: string;
}

// ---------------------------------------------------------------------------------------------
// Provider profiles (what a credential can be created for)
// ---------------------------------------------------------------------------------------------

export interface OpenShellProfileCredential {
  /** The profile's own key for this credential, e.g. `api_token`. */
  name: string;
  description: string;
  /** Env vars the profile exposes this credential as. The first is the default. */
  envVars: string[];
  required: boolean;
}

export interface OpenShellProfileEndpoint {
  host: string;
  port: number;
  /** e.g. `read-only`, when the profile limits what can be done at this endpoint. */
  access?: string;
}

export interface OpenShellProviderProfile {
  id: string;
  displayName: string;
  description: string;
  credentials: OpenShellProfileCredential[];
  endpoints: OpenShellProfileEndpoint[];
  /** Absolute paths of the programs allowed to use the credential. Empty when unrestricted. */
  binaries?: string[];
  /** `true` for a custom profile (`source: user`), the only kind this app may edit or delete. */
  editable?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Editing permissions (provider profiles). BINDING, see §M8.20 rule 14.
// A profile is gateway-wide: changing one changes every sandbox that uses it.
// ---------------------------------------------------------------------------------------------

export type OpenShellEndpointAccess = "read-only" | "read-write";

/** One host a permission lets a credential be sent to. `protocol`/`enforcement` are never set from
 *  here: an existing endpoint keeps its own, a new one gets `rest` / `enforce`. */
export interface OpenShellPermissionEndpoint {
  host: string;
  port: number;
  access: OpenShellEndpointAccess;
}

/** Replaces the editable parts of an existing custom profile. Everything else in it is kept. */
export interface OpenShellUpdateProfileRequest {
  id: string;
  displayName: string;
  description: string;
  /** At least one. */
  endpoints: OpenShellPermissionEndpoint[];
  /** Absolute program paths; empty means any program. */
  binaries: string[];
}

/** A new custom profile with one bearer-token credential (`Authorization: Bearer <placeholder>`). */
export interface OpenShellCreateProfileRequest {
  id: string;
  displayName: string;
  description: string;
  /** Env var the sandbox sees the secret as. */
  credentialEnvVar: string;
  endpoints: OpenShellPermissionEndpoint[];
  binaries: string[];
}

export interface OpenShellDeleteProfileRequest {
  id: string;
}

const HOST_NAME = /^(?:\*\.)?[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;
const MAX_PROFILE_BINARIES = 20;
const MAX_BINARY_CHARS = 255;

/** A hostname, optionally with one leading `*.` wildcard. Never a bare `*`, a scheme, a path or a port. */
export function isOpenShellEndpointHost(value: unknown): value is string {
  return typeof value === "string" && value.length <= 253 && HOST_NAME.test(value);
}

export function isOpenShellPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535;
}

/** An absolute program path without `..`, whitespace or control characters. */
export function isOpenShellBinaryPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_BINARY_CHARS &&
    // eslint-disable-next-line no-control-regex
    /^\/[^\s\u0000-\u001f\u007f]*$/.test(value) &&
    !value.split("/").includes("..")
  );
}

/** `true` when every endpoint and binary is acceptable and there is at least one endpoint. */
export function isValidOpenShellPermission(
  endpoints: unknown,
  binaries: unknown,
): endpoints is OpenShellPermissionEndpoint[] {
  return (
    Array.isArray(endpoints) &&
    endpoints.length > 0 &&
    endpoints.length <= 50 &&
    endpoints.every(
      (e) =>
        e != null &&
        isOpenShellEndpointHost(e.host) &&
        isOpenShellPort(e.port) &&
        (e.access === "read-only" || e.access === "read-write"),
    ) &&
    Array.isArray(binaries) &&
    binaries.length <= MAX_PROFILE_BINARIES &&
    binaries.every((b) => isOpenShellBinaryPath(b))
  );
}

// ---------------------------------------------------------------------------------------------
// Credentials per sandbox
// ---------------------------------------------------------------------------------------------

/**
 * What this app recorded when it created a provider (ids only, in main's own store). The gateway
 * strips the vault reference when it reports a provider back (§M8.18), so this record is the only
 * way to show which vault item a credential points at. A provider made outside the app has none.
 */
export interface OpenShellManagedBinding extends OpenShellCredentialBinding {
  /** Item or secret name at the time the binding was made. Display only; may be stale. */
  label: string;
}

export interface OpenShellSandboxCredential {
  providerName: string;
  /** Profile id / provider type, when the gateway reports it. */
  profileId: string | null;
  /** Bindings this app recorded for the provider. Empty for an unmanaged provider. */
  bindings: OpenShellManagedBinding[];
  /** `true` when this app created the provider and so knows its vault references. */
  managed: boolean;
}

export interface OpenShellAddCredentialRequest {
  sandboxName: string;
  profileId: string;
  /** Optional; main derives `<profileId>-<sandboxName>` when omitted (§M8.3's one-sandbox rule). */
  providerName?: string;
  /** One per profile credential being given. At least one. */
  bindings: Array<OpenShellCredentialBinding & { label: string }>;
}

export interface OpenShellRemoveCredentialRequest {
  sandboxName: string;
  providerName: string;
  /** Also delete the provider itself (only done for providers this app created). */
  deleteProvider: boolean;
}

/** Result of `sandbox provider status` for one sandbox. */
export interface OpenShellApplyStatus {
  /** `true` once the sandbox has applied the latest provider change. */
  applied: boolean;
  /** Gateway text, verbatim, truncated to 200 characters. */
  detail: string;
}
