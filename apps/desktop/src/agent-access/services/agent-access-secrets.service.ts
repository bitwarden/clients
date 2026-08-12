import { Injectable, inject } from "@angular/core";
import { filter, firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { KeyService } from "@bitwarden/key-management";

import { CredentialQueryType } from "../models/credential-query-type";

/** Caps how many Secrets Manager matches are ever built/returned for one request — mirrors
 *  `MAX_CREDENTIAL_MATCHES` in `desktop-agent-access.service.ts` (kept as a separate constant
 *  here since this file is a self-contained SM client, see the class doc). */
const MAX_SM_MATCHES = 20;

/**
 * Header the desktop app sets on its agent-mediated Secrets Manager calls
 * (agent-access-architecture.md, "M4c — server-side event logs", "SM secrets —
 * server-authored, header-signaled"). `SecretsController` reads it (permissive, absent/unknown
 * -> normal event types) to log `Secret_RetrievedByAgent`/`Secret_CreatedByAgent` instead of
 * `Secret_Retrieved`/`Secret_Created` for the user branch. Only the token holder's own client can
 * set this header, and it changes the audit event *flavor* only — never an authorization signal.
 */
const AGENT_MEDIATED_HEADER = "Bitwarden-Agent-Mediated";

/** `ApiService.send`'s `alterHeaders` argument (7th parameter; precedent
 *  `send-api.service.ts`) that marks a call as agent-mediated. Applied to exactly two calls:
 *  the post-approval `GET /secrets/{id}` and the create `POST /organizations/{id}/secrets` —
 *  never to list calls (`findSecrets`/`listProjects`) or `createProject`, which write no
 *  per-agent event server-side. */
const markAgentMediated = (headers: Headers): void => {
  headers.set(AGENT_MEDIATED_HEADER, "1");
};

/**
 * One Secrets Manager secret that matched a request's query, with its (decrypted, but value-less)
 * name resolved — the SM analogue of `CredentialMatch`/`CipherView` in the credential path. Never
 * carries a value; see {@link SmSecretValue} for that.
 */
export interface SmSecretMatch {
  secretId: string;
  name: string;
  organizationId: string;
  organizationName?: string;
}

/**
 * A single Secrets Manager secret's decrypted value, fetched only for the one secret the user has
 * already approved (agent-access-architecture.md, "M4c — server-side event logs": the server
 * writes a `Secret_Retrieved` audit event for every `GET /secrets/{id}` call made with the user's
 * token, so a pre-approval fetch — bulk or single — would forge a retrieval trail for secrets the
 * user never released; one approved release must equal exactly one retrieval event). Deliberately
 * has no `note` field: the secret's note is fetched over the wire as part of the API response but
 * is never decrypted or surfaced here (the secrets analogue of the credential path's "notes never
 * released" invariant).
 */
export interface SmSecretValue {
  secretId: string;
  name: string;
  value: string;
  organizationId: string;
}

/**
 * One Secrets Manager project the user can see, with its (decrypted) name and `write` flag —
 * the M4b analogue of {@link SmSecretMatch} for the project picker in the secret-creation dialog.
 * Only `write === true` projects are legal creation targets (M4b server facts: a non-admin must
 * send exactly one `projectIds` entry for a project they have Write on); this service returns
 * every visible project and leaves that filter to the caller, same division of labor as
 * `findSecrets`'s `read === true` filter happening before matching.
 */
export interface SmProjectMatch {
  id: string;
  name: string;
  write: boolean;
}

/**
 * A single Secrets Manager secret's ciphertexts, fetched to build an `updateSecret` PUT (M6-D —
 * "the rename/move path touches no plaintext value at any layer"). `nameDecrypted` is the ONLY
 * decrypted field here — it exists purely for display (the update dialog's "current name"). The
 * three `*EncString` fields are opaque ciphertext strings, passed through verbatim to `updateSecret`
 * for any field the user doesn't change; `valueEncString`/`noteEncString` are never decrypted by
 * this service or its caller.
 */
export interface SmSecretForUpdate {
  secretId: string;
  organizationId: string;
  nameDecrypted: string;
  keyEncString: string;
  valueEncString: string;
  noteEncString: string;
  currentProjectId?: string;
}

/** A single Secrets Manager secret as returned by `GET /organizations/{orgId}/secrets` — no
 *  value, `Key` is the (encrypted) secret name. */
class SmSecretListItemResponse extends BaseResponse {
  id: string;
  organizationId: string;
  /** Encrypted secret name (server field `Key`). */
  name: string;
  read: boolean;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Key");
    this.read = this.getResponseProperty("Read");
  }
}

/** Wire shape of `GET /organizations/{orgId}/secrets`. */
class SmOrganizationSecretsListResponse extends BaseResponse {
  secrets: SmSecretListItemResponse[];

  constructor(response: unknown) {
    super(response);
    const secrets = this.getResponseProperty("Secrets");
    this.secrets = Array.isArray(secrets)
      ? secrets.map((item: unknown) => new SmSecretListItemResponse(item))
      : [];
  }
}

/**
 * One secret with its value, as returned by `GET /secrets/{id}` (`BaseSecretResponseModel` on the
 * server).
 *
 * `note`/`currentProjectId` exist only for {@link AgentAccessSecretsService.getSecretForUpdate}
 * (M6-D — the rename/move path needs the *ciphertext* passthrough, never the plaintext): `note` is
 * never decrypted anywhere in this class or in `getSecretValue` — the never-released invariant is
 * enforced by never calling `decryptString` on it, not by omitting the field from this parser.
 * `getSecretValue`'s returned {@link SmSecretValue} still never surfaces a `note` property.
 */
class SmSecretDetailResponse extends BaseResponse {
  id: string;
  organizationId: string;
  /** Encrypted secret name (server field `Key`). */
  name: string;
  /** Encrypted secret value (server field `Value`). */
  value: string;
  /** Encrypted note (server field `Note`) — opaque ciphertext, never decrypted here. */
  note: string;
  /** First associated project id, if any (server field `Projects[0].Id`). */
  currentProjectId?: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Key");
    this.value = this.getResponseProperty("Value");
    this.note = this.getResponseProperty("Note");
    const projects = this.getResponseProperty("Projects");
    this.currentProjectId =
      Array.isArray(projects) && projects.length > 0
        ? this.getResponseProperty("Id", projects[0])
        : undefined;
  }
}

/** One Secrets Manager project the user can see, as returned by
 *  `GET /organizations/{orgId}/projects` — org-key-encrypted `Name`, plus per-project
 *  `Read`/`Write` flags (M4b server facts). */
class SmProjectListItemResponse extends BaseResponse {
  id: string;
  organizationId: string;
  /** Encrypted project name. */
  name: string;
  write: boolean;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.write = this.getResponseProperty("Write");
  }
}

/** Wire shape of `GET /organizations/{orgId}/projects` — a standard `ListResponse<T>`, wrapped
 *  under `Data` (unlike `GET /organizations/{orgId}/secrets`, which wraps under `Secrets`). */
class SmProjectListResponse extends BaseResponse {
  data: SmProjectListItemResponse[];

  constructor(response: unknown) {
    super(response);
    const data = this.getResponseProperty("Data");
    this.data = Array.isArray(data)
      ? data.map((item: unknown) => new SmProjectListItemResponse(item))
      : [];
  }
}

/** Wire shape of `POST /organizations/{orgId}/projects` — the created project, `Name` still
 *  encrypted (echoed back, not re-decrypted here; the caller already knows the plaintext it
 *  sent). */
class SmProjectCreateResponse extends BaseResponse {
  id: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
  }
}

/** Wire shape of `POST /secrets/delete` / `POST /projects/delete` (M6-D) —
 *  `{Data: [{Id, Error}]}`; `Error` is a non-null string on a per-id authz/validation failure
 *  (an HTTP 200 reply, not a thrown error). See `AgentAccessSecretsService.assertBulkDeleteSucceeded`. */
class SmBulkDeleteResponse extends BaseResponse {
  results: Array<{ id: string; error?: string }>;

  constructor(response: unknown) {
    super(response);
    const data = this.getResponseProperty("Data");
    this.results = Array.isArray(data)
      ? data.map((item: unknown) => ({
          id: this.getResponseProperty("Id", item),
          error: this.getResponseProperty("Error", item) ?? undefined,
        }))
      : [];
  }
}

/** Wire shape of `POST /organizations/{orgId}/secrets` — only `Id` is read; the created secret's
 *  own `Key`/`Value`/`Note` are never parsed back out of the response (the caller already knows
 *  the plaintext it sent, and the stored value must never be echoed back — M4b invariant 7). */
class SmSecretCreateResponse extends BaseResponse {
  id: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
  }
}

/**
 * Self-contained Secrets Manager client for Agent Access (agent-access-architecture.md, "M4 —
 * Secrets Manager secrets over user auth"). Deliberately fresh code rather than a reuse of
 * `bitwarden_license/bit-web/.../secrets-manager/secrets/secret.service.ts`: `apps/desktop` may
 * not import `bitwarden_license/**` (eslint blanket rule) and no `bit-desktop` overlay exists.
 * This mirrors that file's wire shapes and decrypt pattern (plain
 * `EncryptService.decryptString(new EncString(raw), orgKey)`, org key resolved via
 * `KeyService.orgKeys$(userId)`) without copying its (licensed) source. Pre-merge TODO: product
 * review of whether this belongs behind a future `bit-desktop` overlay instead.
 *
 * The decisive novelty vs. every other SM client: this one authenticates as the logged-in
 * desktop *user*, not a machine access token — the SM API accepts the user's normal bearer token
 * (scope `api` + the per-org `accesssecretsmanager` JWT claim), so no `bws`/service account is
 * involved. A 404 from any SM route can mean "no SM access" OR "the JWT predates SM being
 * enabled for this org" (the claim is baked in at token issuance) — both are treated as an empty
 * result, never a crash (agent-access-architecture.md, M4 fact base).
 *
 * SECURITY: never logs a decrypted secret name or value. `findSecrets` never fetches values;
 * `getSecretValue` is only ever called for the single secret the user has already approved (see
 * its doc comment — M4c), and never decrypts `note`. M6 additions (`getSecretForUpdate`,
 * `updateSecret`, `deleteSecret`, `updateProject`, `deleteProject`) extend the same discipline: an
 * update that doesn't change the value/note never decrypts it (ciphertext passthrough), and a
 * generated value (`generateSecretValue`) lives only in the caller's local scope between
 * generation and the encrypted POST/PUT — never returned to main, never logged
 * (agent-access-architecture.md, "M6", invariants 14-15).
 */
@Injectable({
  providedIn: "root",
})
export class AgentAccessSecretsService {
  private readonly apiService = inject(ApiService);
  private readonly encryptService = inject(EncryptService);
  private readonly keyService = inject(KeyService);
  private readonly organizationService = inject(OrganizationService);
  private readonly logService = inject(LogService);
  private readonly passwordGenerationService = inject(PasswordGenerationServiceAbstraction);

  /** secretId -> decrypted name, populated as `findSecrets` decrypts secret list entries.
   *  Renderer memory only: no persistence, cleared only by process restart. Used by
   *  `AgentAccessActivityComponent` to resolve a released secret's display name without storing
   *  any decrypted Vault/SM data in the main process (mirrors the cipher-name reference model). */
  private readonly secretNameCache = new Map<string, string>();

  /** projectId -> decrypted name — the M6 project analogue of {@link secretNameCache}, populated
   *  as `listProjects` decrypts project list entries (and by `createProject`/`updateProject`,
   *  which already know the plaintext they sent). Used by `AgentAccessActivityComponent` to
   *  resolve a `Created`/`Updated`/`Deleted` project row's display name. */
  private readonly projectNameCache = new Map<string, string>();

  /** Organizations the given user can request Secrets Manager secrets from: enabled orgs with
   *  Secrets Manager access. */
  async smOrganizations(userId: UserId): Promise<Organization[]> {
    try {
      const orgs = await firstValueFrom(this.organizationService.organizations$(userId));
      return (orgs ?? []).filter((org) => org.enabled && org.canAccessSecretsManager);
    } catch (e) {
      this.logService.error("Agent Access: failed to list Secrets Manager organizations", e);
      return [];
    }
  }

  /** Resolves a previously-seen secret's decrypted name from the session-scoped cache, for
   *  display (e.g. the activity log). Returns `undefined` if the secret was never looked up in
   *  this session — the caller falls back to the raw query value. */
  resolveSecretName(secretId: string): string | undefined {
    return this.secretNameCache.get(secretId);
  }

  /** Project analogue of {@link resolveSecretName} — resolves a previously-seen project's
   *  decrypted name from the session-scoped cache, for display (e.g. the activity log). Returns
   *  `undefined` if the project was never looked up (or created/renamed) in this session. */
  resolveProjectName(projectId: string): string | undefined {
    return this.projectNameCache.get(projectId);
  }

  /**
   * Finds every Secrets Manager secret the user can read that matches `queryType`/`queryValue`,
   * across every org where the user has Secrets Manager access. Values are NOT fetched here —
   * only the (decrypted) name, so this is safe to call for every incoming request regardless of
   * whether anything ends up approved. Capped at {@link MAX_SM_MATCHES}.
   *
   * Never throws: an HTTP failure listing one org's secrets, or decrypting one secret's name,
   * skips that org/secret rather than failing the whole lookup (deny-by-default happens upstream
   * on an empty result, not here).
   */
  async findSecrets(
    queryType: CredentialQueryType,
    queryValue: string,
    userId: UserId,
  ): Promise<SmSecretMatch[]> {
    try {
      const orgs = await this.smOrganizations(userId);
      if (orgs.length === 0) {
        return [];
      }

      const orgKeys = await firstValueFrom(
        this.keyService.orgKeys$(userId).pipe(filter((keys) => keys != null)),
      );

      const readable: SmSecretMatch[] = [];
      for (const org of orgs) {
        const orgKey = orgKeys[org.id as OrganizationId];
        if (orgKey == null) {
          // No key for this org (e.g. still syncing) — nothing here can be decrypted, so there's
          // nothing this org can contribute to the match set.
          continue;
        }

        let listed: SmOrganizationSecretsListResponse;
        try {
          listed = await this.listOrganizationSecrets(org.id);
        } catch (e) {
          // Any failure listing an org's secrets (404 = no SM access / stale JWT claim, or a
          // transient error) is treated as "nothing from this org" — never crashes the lookup.
          this.logService.error(
            "Agent Access: failed to list Secrets Manager secrets for an organization",
            e,
          );
          continue;
        }

        const decrypted = await Promise.all(
          listed.secrets
            .filter((item) => item.read === true)
            .map(async (item) => {
              try {
                const name = await this.encryptService.decryptString(
                  new EncString(item.name),
                  orgKey,
                );
                return { item, name };
              } catch (e) {
                // A single undecryptable name skips that secret; it never fails the whole
                // lookup. Never logs the ciphertext or any decrypted content.
                this.logService.error(
                  "Agent Access: failed to decrypt a Secrets Manager secret name",
                  e,
                );
                return null;
              }
            }),
        );

        for (const entry of decrypted) {
          if (entry == null) {
            continue;
          }
          this.secretNameCache.set(entry.item.id, entry.name);
          readable.push({
            secretId: entry.item.id,
            name: entry.name,
            organizationId: org.id,
            organizationName: org.name,
          });
        }
      }

      return this.matchSecrets(queryType, queryValue, readable);
    } catch (e) {
      this.logService.error("Agent Access: Secrets Manager lookup failed", e);
      return [];
    }
  }

  /**
   * Fetches the decrypted value of exactly one Secrets Manager secret, by id — called only after
   * the user has approved that specific secret in the approval dialog
   * (agent-access-architecture.md, "M4c — server-side event logs"): the server writes a
   * `Secret_Retrieved` audit event for every `GET /secrets/{id}` call made with the user's token,
   * so this must never be called for a candidate the user hasn't (yet) approved — one approved
   * release must equal exactly one retrieval event. `note` is fetched over the wire as part of
   * the response but is never parsed out of it — see `SmSecretDetailResponse`.
   *
   * Does NOT swallow failures: a missing org key, an API failure, or an undecryptable
   * value/name must reach the caller so the release pipeline can deny with a generic error +
   * toast (agent-access-architecture.md, M4: "A fetch failure after approval denies with a
   * generic error + toast"), the same discipline as `createProject`/`createSecret`.
   */
  async getSecretValue(
    secretId: string,
    organizationId: string,
    userId: UserId,
  ): Promise<SmSecretValue> {
    const orgKey = await this.resolveOrgKey(organizationId, userId);
    if (orgKey == null) {
      throw new Error("Agent Access: no organization key available to fetch a secret value");
    }

    const detail = await this.getSecretById(secretId);
    const value = await this.encryptService.decryptString(new EncString(detail.value), orgKey);

    // The name was very likely already decrypted and cached by the `findSecrets` call that
    // produced this match (every candidate shown in the dialog went through it) — reuse that
    // rather than a redundant decrypt. A cache miss (e.g. some future id-only path that bypasses
    // `findSecrets`) falls back to decrypting the name carried on this same detail response.
    let name = this.secretNameCache.get(secretId);
    if (name == null) {
      name = await this.encryptService.decryptString(new EncString(detail.name), orgKey);
    }
    this.secretNameCache.set(secretId, name);

    return { secretId, name, value, organizationId };
  }

  /**
   * Lists every Secrets Manager project the user can see in an organization, with decrypted
   * names and `write` flags (M4b — the project picker in the secret-creation dialog). Unlike
   * `findSecrets`, this does no query matching: it hands back the raw (decrypted) list and lets
   * the caller filter to `write === true` and apply the `projectHint` preselect, since both of
   * those are UI concerns, not lookup concerns.
   *
   * Never throws: a failure listing the org's projects, or decrypting one project's name, drops
   * that project (or returns an empty list) rather than failing the whole call — same
   * per-item-skip discipline as `findSecrets`.
   */
  async listProjects(organizationId: string, userId: UserId): Promise<SmProjectMatch[]> {
    try {
      const orgKey = await this.resolveOrgKey(organizationId, userId);
      if (orgKey == null) {
        return [];
      }

      let listed: SmProjectListResponse;
      try {
        listed = await this.listOrganizationProjects(organizationId);
      } catch (e) {
        this.logService.error(
          "Agent Access: failed to list Secrets Manager projects for an organization",
          e,
        );
        return [];
      }

      const decrypted = await Promise.all(
        listed.data.map(async (item): Promise<SmProjectMatch | null> => {
          try {
            const name = await this.encryptService.decryptString(new EncString(item.name), orgKey);
            this.projectNameCache.set(item.id, name);
            return { id: item.id, name, write: item.write };
          } catch (e) {
            this.logService.error(
              "Agent Access: failed to decrypt a Secrets Manager project name",
              e,
            );
            return null;
          }
        }),
      );

      return decrypted.filter((project): project is SmProjectMatch => project != null);
    } catch (e) {
      this.logService.error("Agent Access: Secrets Manager project lookup failed", e);
      return [];
    }
  }

  /**
   * Creates a new Secrets Manager project (M4b — the "create new project" option in the
   * secret-creation dialog). Any SM user may create a project; the server self-grants the
   * creator read+write on it (M4b server facts), which is what makes the just-created project
   * immediately usable as the target of `createSecret` below.
   *
   * Unlike the read paths above, this does NOT swallow failures — a project-creation failure
   * (e.g. a plan's max-projects limit) must propagate to the caller so the creation-approval
   * pipeline can deny with a generic error and toast rather than silently doing nothing.
   *
   * M6 fix: now marked `Bitwarden-Agent-Mediated` like `createSecret` — the M4b version of this
   * method predated the header convention and was an oversight (agent-access-architecture.md,
   * "M6-D": "createProject FIXED to send the header (existing gap)"; invariant 19: "All SM
   * value-reads and mutations send `Bitwarden-Agent-Mediated: 1`").
   */
  async createProject(
    organizationId: string,
    userId: UserId,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const orgKey = await this.resolveOrgKey(organizationId, userId);
    if (orgKey == null) {
      throw new Error("Agent Access: no organization key available to create a project");
    }

    const encryptedName = await this.encryptService.encryptString(name, orgKey);
    const response = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/projects`,
      { name: encryptedName.encryptedString },
      true,
      true,
      null,
      markAgentMediated,
    );
    const created = new SmProjectCreateResponse(response);
    // Seeds the session-scoped project name cache the same way `createSecret` seeds
    // `secretNameCache` — the activity log stores `projectId` only, never a name.
    this.projectNameCache.set(created.id, name);
    return { id: created.id, name };
  }

  /**
   * Creates a new Secrets Manager secret (M4b — `secretCreate`). Mirrors the web SM client's
   * `SecretRequest` wire shape exactly: `key`/`value`/`note` always carry an encrypted string —
   * `note` is encrypted as an empty string when the agent didn't propose one, never omitted —
   * and `accessPoliciesRequests` is left off the body entirely (omission is legal server-side and
   * skips that authz arm; see `secret.service.ts` in `bitwarden_license/bit-web`, read-only
   * reference, not imported). `projectIds` carries exactly one id when `projectId` is given, and
   * is omitted (not an empty array) when it's `null` — the admin-relaxation, project-less create
   * path (M4b server facts: project-less creates are denied for non-admin users; the dialog only
   * offers this path when the org's `isAdmin` allows it).
   *
   * Does NOT swallow failures, for the same reason as `createProject`: an API failure after
   * approval must reach the caller so it can deny with a generic error instead of silently
   * losing the request.
   */
  async createSecret(
    organizationId: string,
    userId: UserId,
    projectId: string | null,
    secret: { name: string; value: string; note?: string },
  ): Promise<string> {
    const orgKey = await this.resolveOrgKey(organizationId, userId);
    if (orgKey == null) {
      throw new Error("Agent Access: no organization key available to create a secret");
    }

    const [key, value, note] = await Promise.all([
      this.encryptService.encryptString(secret.name, orgKey),
      this.encryptService.encryptString(secret.value, orgKey),
      this.encryptService.encryptString(secret.note ?? "", orgKey),
    ]);

    // Marked `Bitwarden-Agent-Mediated` (agent-access-architecture.md, "M4c") so the server logs
    // `Secret_CreatedByAgent` instead of `Secret_Created`.
    const response = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/secrets`,
      {
        key: key.encryptedString,
        value: value.encryptedString,
        note: note.encryptedString,
        projectIds: projectId != null ? [projectId] : undefined,
      },
      true,
      true,
      null,
      markAgentMediated,
    );

    const created = new SmSecretCreateResponse(response);
    // Seeds the session-scoped name cache the same way `findSecrets` does, so the activity log
    // (which stores `secretId` only, never a name — the M4b main-process invariant) can resolve
    // this newly-created secret's display name without a round trip.
    this.secretNameCache.set(created.id, secret.name);
    return created.id;
  }

  /**
   * Fetches the ciphertexts an `updateSecret` PUT needs for a secret update/rename/move
   * (agent-access-architecture.md, "M6-D"). Marked `Bitwarden-Agent-Mediated` — same call as
   * `getSecretValue`'s `GET /secrets/{id}`, so the server logs `Secret_RetrievedByAgent` here too
   * (M6-D: "the update flow writes TWO agent rows by construction ... accurate, since the desktop
   * did retrieve the ciphertexts").
   *
   * Only `Key` (the secret's name) is ever decrypted — `valueEncString`/`noteEncString` are
   * handed back as opaque ciphertext strings for verbatim passthrough when the caller doesn't
   * change them (ciphertext passthrough invariant: an update that doesn't change the value never
   * decrypts it, at any layer).
   *
   * Does NOT swallow failures — called to resolve state *before* the update dialog opens, so a
   * failure here must reach the caller and deny, never silently show a dialog with nothing to
   * display.
   */
  async getSecretForUpdate(
    secretId: string,
    organizationId: string,
    userId: UserId,
  ): Promise<SmSecretForUpdate> {
    const orgKey = await this.resolveOrgKey(organizationId, userId);
    if (orgKey == null) {
      throw new Error("Agent Access: no organization key available to fetch a secret for update");
    }

    const detail = await this.getSecretById(secretId);
    const nameDecrypted = await this.encryptService.decryptString(
      new EncString(detail.name),
      orgKey,
    );
    this.secretNameCache.set(secretId, nameDecrypted);

    return {
      secretId,
      organizationId,
      nameDecrypted,
      keyEncString: detail.name,
      valueEncString: detail.value,
      noteEncString: detail.note,
      currentProjectId: detail.currentProjectId,
    };
  }

  /**
   * `PUT /secrets/{id}` (M6-D). Server semantics are full-replace (agent-access-architecture.md,
   * "M6", server facts): `key`/`value`/`note` are ALWAYS sent as encrypted strings — a changed
   * field (`update.name`/`update.value`/`update.note` present) is freshly encrypted here, an
   * unchanged field falls back to the matching `*EncString` ciphertext passed through verbatim
   * from `getSecretForUpdate`, NEVER decrypted. `update.note === ""` clears the note (encrypts an
   * empty string) — distinct from `undefined`, which passes the original ciphertext through.
   * `projectIds` is omitted unless `update.projectId` is set (a confirmed move), and is NEVER an
   * empty array (the server denies that for non-admins).
   *
   * Does NOT swallow failures: this is the post-approval write, so an API failure (including a
   * generic-message rejection) must reach the caller so it can deny with a generic error + toast.
   */
  async updateSecret(
    organizationId: string,
    userId: UserId,
    secretId: string,
    update: {
      keyEncString: string;
      name?: string;
      valueEncString: string;
      value?: string;
      noteEncString: string;
      note?: string;
      projectId?: string;
    },
  ): Promise<void> {
    const orgKey = await this.resolveOrgKey(organizationId, userId);
    if (orgKey == null) {
      throw new Error("Agent Access: no organization key available to update a secret");
    }

    const [key, value, note] = await Promise.all([
      update.name != null
        ? (await this.encryptService.encryptString(update.name, orgKey)).encryptedString
        : update.keyEncString,
      update.value != null
        ? (await this.encryptService.encryptString(update.value, orgKey)).encryptedString
        : update.valueEncString,
      update.note !== undefined
        ? (await this.encryptService.encryptString(update.note, orgKey)).encryptedString
        : update.noteEncString,
    ]);

    await this.apiService.send(
      "PUT",
      `/secrets/${secretId}`,
      {
        key,
        value,
        note,
        projectIds: update.projectId != null ? [update.projectId] : undefined,
      },
      true,
      true,
      null,
      markAgentMediated,
    );

    if (update.name != null) {
      this.secretNameCache.set(secretId, update.name);
    }
  }

  /**
   * `POST /secrets/delete` (M6-D). The server takes a BARE array of ids — never `{ids: [...]}` —
   * and replies with `{data: [{id, error}]}`; a non-null `error` for this id means the delete was
   * rejected (e.g. an authz failure), surfaced as an HTTP 200 rather than a thrown error, so this
   * checks the per-id result explicitly and throws a generic message (never the server's own
   * text, which can name internal policy details) rather than swallowing it. One id per call —
   * M6 deliberately never bulk-deletes (invariant 16), even though the server endpoint could.
   */
  async deleteSecret(secretId: string, organizationId: string, userId: UserId): Promise<void> {
    const response = await this.apiService.send(
      "POST",
      "/secrets/delete",
      [secretId],
      true,
      true,
      null,
      markAgentMediated,
    );
    this.assertBulkDeleteSucceeded(response, secretId, "secret");
  }

  /**
   * `PUT /projects/{id}` (M6-D) — rename only, mirroring the server (M6 server facts: "`PUT
   * /projects/{id}` (rename only, needs project Write)"). Marked `Bitwarden-Agent-Mediated` like
   * every other SM mutation (invariant 19).
   */
  async updateProject(
    projectId: string,
    organizationId: string,
    userId: UserId,
    name: string,
  ): Promise<void> {
    const orgKey = await this.resolveOrgKey(organizationId, userId);
    if (orgKey == null) {
      throw new Error("Agent Access: no organization key available to rename a project");
    }

    const encryptedName = await this.encryptService.encryptString(name, orgKey);
    await this.apiService.send(
      "PUT",
      `/projects/${projectId}`,
      { name: encryptedName.encryptedString },
      true,
      true,
      null,
      markAgentMediated,
    );
    this.projectNameCache.set(projectId, name);
  }

  /**
   * `POST /projects/delete` (M6-D) — same bare-array/per-id-error shape as `deleteSecret`. This is
   * a HARD delete server-side (the Project row is removed; contained secrets survive project-less
   * — M6 server facts), which is why the confirm-delete dialog's copy for a project must say
   * "permanent," never "trash" (agent-access-architecture.md invariant 17). This method itself
   * only performs the call; the consequence-labeling truthfulness lives in the dialog copy.
   */
  async deleteProject(projectId: string, organizationId: string, userId: UserId): Promise<void> {
    const response = await this.apiService.send(
      "POST",
      "/projects/delete",
      [projectId],
      true,
      true,
      null,
      markAgentMediated,
    );
    this.assertBulkDeleteSucceeded(response, projectId, "project");
  }

  /**
   * `GET /projects/{projectId}/secrets` (M6-D) — unlogged server-side (no header needed, like
   * every other list endpoint), used only to power the confirm-delete dialog's orphan-count
   * warning ("N secrets will lose this project"). A read path: degrades to `undefined` on any
   * failure rather than throwing, so a count that can't be resolved just makes the dialog warn
   * without a number instead of blocking the whole delete flow.
   */
  async countSecretsInProject(
    projectId: string,
    organizationId: string,
    userId: UserId,
  ): Promise<number | undefined> {
    try {
      const response = await this.apiService.send(
        "GET",
        `/projects/${projectId}/secrets`,
        null,
        true,
        true,
      );
      // Wraps under `Secrets`, like `GET /organizations/{orgId}/secrets` (see
      // `SmOrganizationSecretsListResponse`) — verified against that existing parser.
      const listed = new SmOrganizationSecretsListResponse(response);
      return listed.secrets.length;
    } catch (e) {
      this.logService.error(
        "Agent Access: failed to count secrets in a Secrets Manager project",
        e,
      );
      return undefined;
    }
  }

  /**
   * Generates a random secret value for a `generate: true` create/update (M6-D) — deliberately
   * `PasswordGenerationServiceAbstraction.generatePassword`, the deprecated, account-independent
   * façade, rather than `CredentialGeneratorService.generate$`: the latter's ceremony (active
   * account context, saved generator policy/history) has nothing to attach to here — this value
   * is born, encrypted, and discarded inside a single request handler, never saved to the user's
   * own generator history. The generated string is returned to the caller's local scope only; it
   * must never be logged, returned to the agent, or included in any IPC response/outcome
   * (agent-access-architecture.md, invariant 14).
   */
  async generateSecretValue(options: { length?: number; symbols?: boolean } = {}): Promise<string> {
    const symbols = options.symbols ?? true;
    return this.passwordGenerationService.generatePassword({
      length: options.length ?? 40,
      uppercase: true,
      lowercase: true,
      number: true,
      minNumber: 1,
      special: symbols,
      minSpecial: symbols ? 1 : 0,
      ambiguous: true,
    });
  }

  /** Shared per-id error check for `POST /secrets/delete` / `POST /projects/delete` — both reply
   *  `{data: [{id, error}]}` (PascalCase on the wire: `{Data: [{Id, Error}]}`) with a non-null
   *  `error` string on a per-id authz/validation failure (an HTTP 200, not a thrown error).
   *  Throws a generic message, deliberately never the server's own `error` text (which can name
   *  internal policy details), matching the "never the server's message verbatim" rule for
   *  post-approval failures. */
  private assertBulkDeleteSucceeded(
    response: unknown,
    id: string,
    kind: "secret" | "project",
  ): void {
    const parsed = new SmBulkDeleteResponse(response);
    const entry = parsed.results.find((result) => result.id === id);
    if (entry?.error != null) {
      throw new Error(`Agent Access: failed to delete a Secrets Manager ${kind}`);
    }
  }

  /** Resolves the caller's org key for `organizationId`, or `undefined` if the account has no
   *  key for it yet (e.g. still syncing) — the same "nothing can be decrypted/encrypted, so
   *  there's nothing this call can do" case `findSecrets` treats as an empty contribution. */
  private async resolveOrgKey(organizationId: string, userId: UserId): Promise<OrgKey | undefined> {
    const orgKeys = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(filter((keys) => keys != null)),
    );
    return orgKeys[organizationId as OrganizationId];
  }

  /** `GET /organizations/{orgId}/projects` — decrypted-name-eligible list, with `write` flags. */
  private async listOrganizationProjects(organizationId: string): Promise<SmProjectListResponse> {
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/projects`,
      null,
      true,
      true,
    );
    return new SmProjectListResponse(response);
  }

  /** `GET /organizations/{orgId}/secrets` — no values, decrypted-name-eligible list only. */
  private async listOrganizationSecrets(
    organizationId: string,
  ): Promise<SmOrganizationSecretsListResponse> {
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/secrets`,
      null,
      true,
      true,
    );
    return new SmOrganizationSecretsListResponse(response);
  }

  /** `GET /secrets/{id}` — the single, post-approval detail fetch `getSecretValue` uses. Marked
   *  `Bitwarden-Agent-Mediated` (agent-access-architecture.md, "M4c") so the server logs
   *  `Secret_RetrievedByAgent` instead of `Secret_Retrieved`. */
  private async getSecretById(id: string): Promise<SmSecretDetailResponse> {
    const response = await this.apiService.send(
      "GET",
      `/secrets/${id}`,
      null,
      true,
      true,
      null,
      markAgentMediated,
    );
    return new SmSecretDetailResponse(response);
  }

  /** `name` = exact match, else a unique case-insensitive match; `id` = secret UUID; `search` =
   *  substring, exact-name matches ranked first (mirrors `findCiphers`'s search ranking in
   *  `desktop-agent-access.service.ts`). Any other query type (the credential-only types) matches
   *  nothing here — the pipeline never routes those to this service. */
  private matchSecrets(
    queryType: CredentialQueryType,
    queryValue: string,
    secrets: SmSecretMatch[],
  ): SmSecretMatch[] {
    switch (queryType) {
      case CredentialQueryType.Name: {
        const exact = secrets.find((secret) => secret.name === queryValue);
        if (exact != null) {
          return [exact];
        }
        const lowerQuery = queryValue.toLowerCase();
        const caseInsensitive = secrets.filter(
          (secret) => secret.name.toLowerCase() === lowerQuery,
        );
        return caseInsensitive.length === 1 ? caseInsensitive : [];
      }
      case CredentialQueryType.Id: {
        const match = secrets.find((secret) => secret.secretId === queryValue);
        return match != null ? [match] : [];
      }
      case CredentialQueryType.Search: {
        const lowerQuery = queryValue.toLowerCase();
        const ordered: SmSecretMatch[] = [];
        const seenIds = new Set<string>();
        const addMatches = (predicate: (secret: SmSecretMatch) => boolean) => {
          for (const secret of secrets) {
            if (ordered.length >= MAX_SM_MATCHES) {
              return;
            }
            if (!seenIds.has(secret.secretId) && predicate(secret)) {
              seenIds.add(secret.secretId);
              ordered.push(secret);
            }
          }
        };
        addMatches((secret) => secret.name.toLowerCase() === lowerQuery);
        addMatches((secret) => secret.name.toLowerCase().includes(lowerQuery));
        return ordered;
      }
      default:
        return [];
    }
  }
}
