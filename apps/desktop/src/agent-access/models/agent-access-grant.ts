/**
 * What a grant authorizes the requester to see once the per-request approval dialog also says
 * yes. Only `AllLogins` exists in Phase 1 (agent-access-desktop-plan.md, W5's intro) — the field
 * exists from day one so Phase 2 can add collection/item scopes without a storage migration.
 */
export const AgentAccessGrantScope = Object.freeze({
  AllLogins: "allLogins",
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
}

/** Input to `upsertGrant`: creates a new grant for this key, or refreshes the existing one's
 *  `lastUsedAt`/display metadata if a grant for this key already exists. */
export interface UpsertAgentAccessGrantInput extends AgentAccessGrantKey {
  displayName: string;
  exePath?: string;
  scope: AgentAccessGrantScope;
}
