/**
 * Hand-mirrored types for the optional NVIDIA OpenShell integration
 * (agent-access-architecture.md, "§M8 OpenShell integration"). Plain data plus pure validators,
 * so both the main process and the renderer can import this file.
 *
 * Everything that describes a sandbox, provider, image, endpoint or policy is *reported by the
 * OpenShell gateway* and never verified by Bitwarden. Only the gateway process identity (OS
 * attestation of `aac`'s parent) is verified.
 */

/** Why the OpenShell integration can't be offered on this install (§M8.8). */
export type OpenShellUnsupportedReason = "windows" | "snap" | "appImage";

/** One OpenShell gateway from the client config dir. Only non-secret metadata is read. */
export interface OpenShellGatewayInfo {
  name: string;
  endpoint: string;
  authMode: string;
  active: boolean;
  authSupported: boolean;
}

/** Result of `DETECT_OPENSHELL`. Detection never runs a process or opens a connection. */
export interface OpenShellDetectionResult {
  /** `cliPath || gatewayBinaryPath || gatewayConfigPath || systemdUnitPath`. */
  present: boolean;
  /** darwin or linux, and no `unsupportedReason`. */
  platformSupported: boolean;
  unsupportedReason?: OpenShellUnsupportedReason;
  cliPath?: string;
  gatewayBinaryPath?: string;
  gatewayConfigPath?: string;
  systemdUnitPath?: string;
  gateways: OpenShellGatewayInfo[];
  /** Where the user should merge the snippet. */
  gatewayConfigPathHint: string;
}

/** Copyable text for the Setup tab — the fallback when the one-button setup can't run (§M8.19). */
export interface OpenShellSnippet {
  gatewayToml: string;
  providerExample: string;
  attachExample: string;
  gatewayName: string;
}

/** How the one-button setup restarts the gateway after editing its config (§M8.19). */
export type OpenShellRestartMethod = "brew" | "systemd" | "manual";

/** Why the one-button setup could not finish by itself. The renderer maps each to its own copy. */
export type OpenShellSetupFailure =
  "unsupported" | "noBundledCli" | "unmergeable" | "notWritable" | "restartFailed";

/** Result of `GET_OPENSHELL_SETUP_STATUS`. Read-only: nothing is written or run to produce it. */
export interface OpenShellSetupStatus {
  /** Where `gateway.toml` is (or will be created). */
  configPath: string;
  /** The config already lists the driver and points at this app's `aac`. */
  configured: boolean;
  /** Setup can run: supported platform and a bundled `aac` to point at. */
  canSetUp: boolean;
  /** Set when `canSetUp` is false, or when the existing file can't be edited safely. */
  blockedReason?: OpenShellSetupFailure;
  restartMethod: OpenShellRestartMethod;
}

/** Result of `RUN_OPENSHELL_SETUP` and `REMOVE_OPENSHELL_SETUP`. */
export interface OpenShellSetupResult {
  ok: boolean;
  failure?: OpenShellSetupFailure;
  /** A non-secret explanation of an `unmergeable` file, e.g. "credential_drivers is defined more
   *  than once". Main-authored text, never file contents. */
  detail?: string;
  /** `gateway.toml` was changed (false when it was already correct). */
  configChanged: boolean;
  /** The gateway was restarted by this call. */
  restarted: boolean;
  /** `Date.now()` when the restart returned, so the renderer can tell a driver connection made
   *  after it from an earlier one. */
  restartedAtMs?: number;
  restartMethod: OpenShellRestartMethod;
  /** Where the previous file was copied before it was changed. */
  backupPath?: string;
}

export interface SetOpenShellListenerResult {
  listening: boolean;
  refusedReason?: "notDetected" | "unsupportedPlatform" | "agentAccessNotRunning";
}

/** Mirrors napi's `OpenShellEndpointData` (camelCase). */
export interface OpenShellEndpoint {
  host: string;
  port: number;
  path?: string;
  source: "profile" | "policyBinding";
}

/** Mirrors napi's `OpenShellContextData`. Gateway-reported, never verified by Bitwarden. */
export interface OpenShellRequestContext {
  deadlineMs: number;
  gatewayName: string;
  gatewayEndpoint: string;
  providerId: string;
  providerName: string;
  providerProfile: string;
  workspace: string;
  sandboxId: string;
  sandboxName: string;
  sandboxImage?: string;
  endpoints: OpenShellEndpoint[];
  policyDigest: string;
  advisorEnabled?: boolean;
}

/** Mirrors napi's `ProviderTargetData`. Ids and env-var names only, never values. */
export interface OpenShellProviderTarget {
  credentialKey: string;
  resourceType: "credential" | "secret";
  id: string;
  field: "username" | "password" | "value";
}

export type OpenShellLifetimeMode = "perRequest" | "ttl" | "sandboxLifetime";

export const OpenShellLifetimeModes = Object.freeze({
  PerRequest: "perRequest",
  Ttl: "ttl",
  SandboxLifetime: "sandboxLifetime",
} as const satisfies Record<string, OpenShellLifetimeMode>);

export const OPENSHELL_TTL_CHOICES_MINUTES = [15, 60, 240, 480, 1440] as const;
export type OpenShellTtlMinutes = (typeof OPENSHELL_TTL_CHOICES_MINUTES)[number];

export interface OpenShellApprovalLifetime {
  mode: OpenShellLifetimeMode;
  ttlMinutes: OpenShellTtlMinutes;
}

/** §M8.6: `perRequest` releases a value usable for 2 minutes after approval. */
export const OPENSHELL_PER_REQUEST_WINDOW_MS = 120_000;

/** §M8.6 default: a 1-hour approval window. */
export const DEFAULT_OPENSHELL_APPROVAL_LIFETIME: OpenShellApprovalLifetime = Object.freeze({
  mode: "ttl",
  ttlMinutes: 60,
});

/**
 * §M8.6 TTL rule: a ttl window is reused only while it still has more than this much left. The
 * Rust reply builder refuses a ttl expiry closer than 30 s, so reuse also needs room for the
 * dialog's own deadline (see `AgentAccessOpenShellService`).
 */
export const OPENSHELL_TTL_REUSE_MARGIN_MS = 30_000;

/**
 * §M8.18 coalescing. A user decision (approve or deny) that no waiting request could take is kept
 * for this long for the identical request key, so the supervisor's next retry is answered at once
 * instead of opening another dialog. In memory only; never holds a value.
 */
export const OPENSHELL_CARRY_WINDOW_MS = 60_000;

/**
 * §M8.18 double resolve. After an approval was delivered, an identical-key resolve within this
 * window is the same credential load (OpenShell resolves twice per load) and is answered without
 * a dialog, in every lifetime mode. Measured from the delivery, never extended by reuse.
 */
export const OPENSHELL_DELIVERED_DEDUPE_MS = 10_000;

/** §M8.18: a coalesced dialog stays open this long past the last attached request's deadline,
 *  so the supervisor's next retry can still attach to it. */
export const OPENSHELL_DIALOG_LINGER_MS = 15_000;

/** §M8.18: hard cap on how long one coalesced dialog stays open. */
export const OPENSHELL_DIALOG_MAX_MS = 60_000;

export function isOpenShellLifetimeMode(value: unknown): value is OpenShellLifetimeMode {
  return value === "perRequest" || value === "ttl" || value === "sandboxLifetime";
}

export function isOpenShellTtlMinutes(value: unknown): value is OpenShellTtlMinutes {
  return (OPENSHELL_TTL_CHOICES_MINUTES as readonly unknown[]).includes(value);
}

/** Coerces a persisted (or renderer-supplied) lifetime value to a valid one, falling back to the
 *  §M8.6 default for anything malformed. */
export function coerceOpenShellApprovalLifetime(value: unknown): OpenShellApprovalLifetime {
  if (value == null || typeof value !== "object") {
    return { ...DEFAULT_OPENSHELL_APPROVAL_LIFETIME };
  }
  const candidate = value as Partial<OpenShellApprovalLifetime>;
  if (!isOpenShellLifetimeMode(candidate.mode) || !isOpenShellTtlMinutes(candidate.ttlMinutes)) {
    return { ...DEFAULT_OPENSHELL_APPROVAL_LIFETIME };
  }
  return { mode: candidate.mode, ttlMinutes: candidate.ttlMinutes };
}

// ---------------------------------------------------------------------------------------------
// §M8.4 field limits, shared by the main-process grant validation and the renderer.
// ---------------------------------------------------------------------------------------------

/** `char::is_control` equivalent: C0, DEL and C1 controls. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;
const GATEWAY_NAME = /^[A-Za-z0-9._-]{1,64}$/;
const OPAQUE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const POLICY_DIGEST = /^sha256:[0-9a-f]{64}$/;

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** A string of `min..=max` UTF-8 bytes with no control characters. */
export function isBoundedOpenShellString(value: unknown, min: number, max: number): boolean {
  if (typeof value !== "string" || CONTROL_CHARACTER.test(value)) {
    return false;
  }
  const length = utf8Length(value);
  return length >= min && length <= max;
}

export function isOpenShellGatewayName(value: unknown): value is string {
  return typeof value === "string" && GATEWAY_NAME.test(value);
}

export function isOpenShellOpaqueId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}

export function isOpenShellGatewayEndpoint(value: unknown): value is string {
  return (
    isBoundedOpenShellString(value, 1, 256) &&
    ((value as string).startsWith("https://") || (value as string).startsWith("http://")) &&
    !/\s/.test(value as string)
  );
}

export function isOpenShellPolicyDigest(value: unknown): value is string {
  return typeof value === "string" && POLICY_DIGEST.test(value);
}

/** The first 12 hex characters of a policy digest, for display. */
export function openShellDigestPrefix(digest: string): string {
  return digest.replace(/^sha256:/, "").slice(0, 12);
}

/** §M8.4: the desktop OpenShell listener, `~/` relative. Computed in main, never by the renderer. */
export const OPENSHELL_DESKTOP_SOCKET_FILENAME = ".bitwarden-agent-access-openshell.sock";
/** §M8.4: the socket aac binds for the gateway, `~/` relative. Only ever shown in the snippet. */
export const OPENSHELL_DRIVER_SOCKET_FILENAME = ".bitwarden-openshell-driver.sock";
/** §M8.8: snippet fallback when no gateway is configured yet. */
export const OPENSHELL_DEFAULT_GATEWAY_NAME = "openshell";
