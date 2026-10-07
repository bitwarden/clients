import {
  isBoundedOpenShellString,
  isOpenShellGatewayEndpoint,
  isOpenShellGatewayName,
  isOpenShellLifetimeMode,
  isOpenShellOpaqueId,
  isOpenShellPolicyDigest,
  OpenShellLifetimeMode,
} from "./openshell";

/**
 * What a grant authorizes the requester to see once the per-request approval dialog also says
 * yes. Only `AllLogins` exists in Phase 1 (agent-access-desktop-plan.md, W5's intro) — the field
 * exists from day one so Phase 2 can add collection/item scopes without a storage migration.
 */
export const AgentAccessGrantScope = Object.freeze({
  AllLogins: "allLogins",
  /**
   * One OpenShell sandbox + provider on one gateway (agent-access-architecture.md, §M8.5). Like
   * every grant, it is the right to *ask*: every OpenShell request still opens the approval
   * dialog. The grant only selects the dialog mode (first use, policy changed, window expired,
   * previously approved).
   */
  OpenShellSandbox: "openshellSandbox",
} as const);
export type AgentAccessGrantScope =
  (typeof AgentAccessGrantScope)[keyof typeof AgentAccessGrantScope];

/** Type guard for a value the renderer sent over IPC (`UPSERT_GRANT`) — the renderer is a
 *  distrusted caller at this boundary, so `scope` must be checked against the known member set
 *  rather than trusted as already-typed. */
export function isAgentAccessGrantScope(value: unknown): value is AgentAccessGrantScope {
  return (
    typeof value === "string" && (Object.values(AgentAccessGrantScope) as string[]).includes(value)
  );
}

/**
 * Identifies which grant applies to a local request's attested peer. Keyed by code-signature
 * identity when the attested process has a valid one; unsigned/invalid-signature/unresolvable
 * peers key on the canonical executable path instead, so swapping the binary at that path
 * invalidates the grant and forces re-authorization (agent-access-architecture.md, "Grant store
 * (W2b)"). See `deriveAgentAccessAttestationKey` in `utils/agent-access-attestation.util.ts` for
 * how a key is computed from `LocalPeerInfoData`.
 */
export interface AgentAccessGrantKey {
  signatureKind: string;
  signatureIdentity: string;
  /**
   * Present only for an OpenShell grant (§M8.5). `signatureKind`/`signatureIdentity` are then the
   * attested *gateway* identity (aac's parent). A key with `openshell` never matches a grant
   * without it, and the reverse is also true.
   */
  openshell?: AgentAccessOpenShellGrantKey;
}

/** The OpenShell part of a grant key: which gateway, sandbox and provider (§M8.5). All three are
 *  gateway-reported ids; the gateway's own process identity is the attested part of the key. */
export interface AgentAccessOpenShellGrantKey {
  gatewayEndpoint: string;
  sandboxId: string;
  providerId: string;
}

/** Display and lifetime details stored with an OpenShell grant. `policyDigest` is deliberately
 *  not part of the key: a changed digest selects the `policyChanged` dialog mode instead. */
export interface AgentAccessOpenShellGrantDetails extends AgentAccessOpenShellGrantKey {
  gatewayName: string;
  sandboxName: string;
  providerName: string;
  /** `"sha256:<64 hex>"`. */
  policyDigest: string;
  lifetimeMode: OpenShellLifetimeMode;
  /** ttl mode only: Unix ms end of the current approval window. Never extended by a reuse. */
  windowExpiresAtMs?: number;
}

/** §M8.4 limits for the three OpenShell key fields. The renderer is untrusted at the IPC
 *  boundary, so main checks every field (type, length, charset). */
export function isAgentAccessOpenShellGrantKey(
  value: unknown,
): value is AgentAccessOpenShellGrantKey {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<AgentAccessOpenShellGrantKey>;
  return (
    isOpenShellGatewayEndpoint(candidate.gatewayEndpoint) &&
    isOpenShellOpaqueId(candidate.sandboxId) &&
    isOpenShellOpaqueId(candidate.providerId)
  );
}

/** §M8.5 `UPSERT_GRANT` validation for the OpenShell details. */
export function isAgentAccessOpenShellGrantDetails(
  value: unknown,
): value is AgentAccessOpenShellGrantDetails {
  if (!isAgentAccessOpenShellGrantKey(value)) {
    return false;
  }
  const candidate = value as Partial<AgentAccessOpenShellGrantDetails>;
  if (
    !isOpenShellGatewayName(candidate.gatewayName) ||
    !isBoundedOpenShellString(candidate.sandboxName, 0, 128) ||
    !isBoundedOpenShellString(candidate.providerName, 1, 128) ||
    !isOpenShellPolicyDigest(candidate.policyDigest) ||
    !isOpenShellLifetimeMode(candidate.lifetimeMode)
  ) {
    return false;
  }
  if (candidate.lifetimeMode === "ttl") {
    return (
      typeof candidate.windowExpiresAtMs === "number" &&
      Number.isSafeInteger(candidate.windowExpiresAtMs) &&
      candidate.windowExpiresAtMs > 0
    );
  }
  return candidate.windowExpiresAtMs === undefined;
}

/**
 * A persistent "first-use" authorization grant for a local Agent Access requester
 * (agent-access-architecture.md, "Grant store (W2b)"). Grants replace local pairing entirely: the
 * first time an attested peer asks for a credential, the user authorizes it once via
 * `FirstUseAuthorizationDialogComponent`; every request after that still goes through the normal
 * per-request approval dialog unchanged — a grant authorizes the agent to *ask*, never a standing
 * "always allow" (agent-access-desktop-plan.md, W5 — no such option exists in v1).
 *
 * Main-process-local: lives in the OS keychain alongside the identity/connections/psks entries
 * (`MainAgentAccessService`'s `KEYCHAIN_SERVICE_NAME`, key `"grants"`). The renderer only ever
 * sees this DTO — identity/scope metadata, no secrets — via the LIST_GRANTS / UPSERT_GRANT /
 * REMOVE_GRANT / FIND_GRANT IPC handlers; the raw keychain blob never crosses IPC.
 */
export interface AgentAccessGrant extends AgentAccessGrantKey {
  id: string;
  displayName: string;
  exePath?: string;
  scope: AgentAccessGrantScope;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. Refreshed on every subsequent authorized request, not just re-authorization. */
  lastUsedAt: number;
  /** OpenShell grants only (`scope === "openshellSandbox"`). */
  openshell?: AgentAccessOpenShellGrantDetails;
}

/** Input to `upsertGrant`: creates a new grant for this key, or refreshes the existing one's
 *  `lastUsedAt`/display metadata if a grant for this key already exists. */
export interface UpsertAgentAccessGrantInput extends AgentAccessGrantKey {
  displayName: string;
  exePath?: string;
  scope: AgentAccessGrantScope;
  /** Required iff `scope === "openshellSandbox"` (§M8.5). */
  openshell?: AgentAccessOpenShellGrantDetails;
}
