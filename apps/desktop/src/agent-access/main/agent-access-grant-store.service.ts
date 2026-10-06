import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { passwords } from "@bitwarden/desktop-napi";
import { newGuid } from "@bitwarden/guid";

import {
  AgentAccessGrant,
  AgentAccessGrantKey,
  UpsertAgentAccessGrantInput,
} from "../models/agent-access-grant";

/** Keychain key for the grant blob, alongside the existing identity/connections/psks entries
 *  under `MainAgentAccessService`'s `KEYCHAIN_SERVICE_NAME`. */
const GRANTS_STORAGE_KEY = "grants";

interface GrantsStorageShape {
  grants: AgentAccessGrant[];
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Main-process-local persistence for Agent Access "first-use" authorization grants
 * (agent-access-architecture.md, "Grant store (W2b)"). Delegated to by `MainAgentAccessService`,
 * which owns the IPC handlers and the keychain service name — this class only knows how to
 * read/write the JSON blob and how grants are keyed, so it's testable without touching
 * `ipcMain`.
 *
 * The raw store never crosses IPC: the renderer only ever sees `AgentAccessGrant` DTOs (identity
 * and scope metadata, no secrets) via `MainAgentAccessService`'s handlers.
 */
export class AgentAccessGrantStoreService {
  constructor(
    private logService: LogService,
    private keychainServiceName: string,
  ) {}

  async list(): Promise<AgentAccessGrant[]> {
    const { grants } = await this.loadForRead();
    return grants;
  }

  async find(key: AgentAccessGrantKey): Promise<AgentAccessGrant | null> {
    // Fail closed: a peer with no attestable identity (no valid signature AND no resolvable exe
    // path) degenerates to `("path", "")` — see `deriveAgentAccessAttestationKey`'s fallback chain.
    // Matching on that empty key would let one "Unknown application" grant silently cover every
    // future fully-unattestable process, collapsing the first-use gate. Refuse to match at all, so
    // such a peer always re-prompts.
    if (!this.hasAttestableIdentity(key)) {
      return null;
    }
    const { grants } = await this.loadForRead();
    return grants.find((grant) => this.matchesKey(grant, key)) ?? null;
  }

  /** Creates a new grant for `input`'s key, or — if one already exists — refreshes its
   *  `lastUsedAt` and display metadata (name/exe path can legitimately change: an app update, a
   *  moved bundle) while preserving its `id`, `createdAt`, and scope. Returns `null` without
   *  persisting anything for a key with no attestable identity (see `find`'s doc comment) — the
   *  caller (`MainAgentAccessService`'s `UPSERT_GRANT` handler) treats a `null` the same as "no
   *  grant possible", so the next request from that peer prompts again rather than silently
   *  inheriting a universal grant. */
  async upsert(input: UpsertAgentAccessGrantInput): Promise<AgentAccessGrant | null> {
    if (!this.hasAttestableIdentity(input)) {
      this.logService.warning(
        "[Agent Access] Refusing to persist a grant with no attestable identity (empty " +
          "signatureIdentity); the peer will be re-prompted on every request instead.",
      );
      return null;
    }

    // Read-before-write: unlike `list`/`find`, a transient failure here must not be treated as
    // "empty" — see `loadForWrite`'s doc comment for why.
    const store = await this.loadForWrite();
    const now = nowInSeconds();
    const existingIndex = store.grants.findIndex((grant) => this.matchesKey(grant, input));

    let grant: AgentAccessGrant;
    if (existingIndex >= 0) {
      grant = {
        ...store.grants[existingIndex],
        displayName: input.displayName,
        exePath: input.exePath,
        lastUsedAt: now,
        // An OpenShell grant's details (digest, lifetime mode, ttl window) are refreshed on every
        // approval; the key fields are unchanged by construction (`matchesKey`).
        ...(input.openshell != null ? { openshell: { ...input.openshell } } : {}),
      };
      store.grants[existingIndex] = grant;
    } else {
      grant = {
        id: newGuid(),
        signatureKind: input.signatureKind,
        signatureIdentity: input.signatureIdentity,
        displayName: input.displayName,
        exePath: input.exePath,
        scope: input.scope,
        createdAt: now,
        lastUsedAt: now,
        ...(input.openshell != null ? { openshell: { ...input.openshell } } : {}),
      };
      store.grants.push(grant);
    }

    await this.save(store);
    return grant;
  }

  async remove(id: string): Promise<void> {
    // Read-before-write: same rationale as `upsert` — a transient read failure must abort rather
    // than clobber.
    const store = await this.loadForWrite();
    const remaining = store.grants.filter((grant) => grant.id !== id);
    if (remaining.length === store.grants.length) {
      return;
    }
    await this.save({ grants: remaining });
  }

  /**
   * Exact-identity match. §M8.5: `openshell` must be present on both sides or absent on both, and
   * all three OpenShell fields must be equal — so a plain-local grant never satisfies an
   * OpenShell request, and an OpenShell grant never satisfies a plain-local one (or a different
   * sandbox, provider or gateway).
   */
  private matchesKey(grant: AgentAccessGrantKey, key: AgentAccessGrantKey): boolean {
    if (
      grant.signatureKind !== key.signatureKind ||
      grant.signatureIdentity !== key.signatureIdentity
    ) {
      return false;
    }
    const grantOpenShell = grant.openshell;
    const keyOpenShell = key.openshell;
    if (grantOpenShell == null || keyOpenShell == null) {
      return grantOpenShell == null && keyOpenShell == null;
    }
    return (
      grantOpenShell.gatewayEndpoint === keyOpenShell.gatewayEndpoint &&
      grantOpenShell.sandboxId === keyOpenShell.sandboxId &&
      grantOpenShell.providerId === keyOpenShell.providerId
    );
  }

  /** A key/input with no non-empty `signatureIdentity` has no attestable identity at all — see the
   *  fail-closed doc comments on `find`/`upsert` above. */
  private hasAttestableIdentity(key: AgentAccessGrantKey): boolean {
    return typeof key.signatureIdentity === "string" && key.signatureIdentity.trim().length > 0;
  }

  /** Reads the keychain blob, returning an empty store for the ordinary "nothing persisted yet"
   *  case (`PASSWORD_NOT_FOUND`). Does not distinguish that from any other read failure — callers
   *  that only ever read (`list`/`find`) are safe to treat both the same way: fail closed to an
   *  empty grant list, which just means an extra first-use re-prompt, never data loss. */
  private async loadForRead(): Promise<GrantsStorageShape> {
    try {
      const raw = await passwords.getPassword(this.keychainServiceName, GRANTS_STORAGE_KEY);
      return this.parse(raw);
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        return { grants: [] };
      }
      this.logService.error("[Agent Access] Failed to read the grant store", e);
      return { grants: [] };
    }
  }

  /** Reads the keychain blob for a load-mutate-save write (`upsert`/`remove`). `PASSWORD_NOT_FOUND`
   *  is still the ordinary "no grants yet" case and resolves to an empty store, same as
   *  `loadForRead`. Any *other* read failure (a transient keychain error, for example) is rethrown
   *  instead of being swallowed to `{ grants: [] }`: swallowing it here would let the caller's
   *  subsequent `save` persist that empty view over whatever grants actually exist, destroying them
   *  all. The caller aborts the write instead. */
  private async loadForWrite(): Promise<GrantsStorageShape> {
    try {
      const raw = await passwords.getPassword(this.keychainServiceName, GRANTS_STORAGE_KEY);
      return this.parse(raw);
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        return { grants: [] };
      }
      this.logService.error(
        "[Agent Access] Failed to read the grant store before a write; aborting instead of " +
          "risking an overwrite of existing grants",
        e,
      );
      throw e;
    }
  }

  private parse(raw: string | null | undefined): GrantsStorageShape {
    if (raw == null) {
      return { grants: [] };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const grants =
        parsed != null && Array.isArray((parsed as GrantsStorageShape).grants)
          ? (parsed as GrantsStorageShape).grants
          : [];
      return { grants };
    } catch (e) {
      this.logService.error("[Agent Access] Failed to parse the grant store", e);
      return { grants: [] };
    }
  }

  private async save(store: GrantsStorageShape): Promise<void> {
    await passwords.setPassword(
      this.keychainServiceName,
      GRANTS_STORAGE_KEY,
      JSON.stringify(store),
    );
  }
}
