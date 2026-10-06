import { AgentAccessOperation } from "./agent-access-operation";
import { AgentAccessResourceType } from "./agent-access-resource-type";
import { CredentialQueryType } from "./credential-query-type";

/**
 * How a credential request ended.
 *
 * A request is opened as {@link AgentAccessRequestStatus.Pending} the moment the Rust agent hands
 * it to the main process, and is resolved exactly once when the renderer answers. It stays
 * `Pending` if the renderer never answers at all (e.g. the credential pipeline isn't listening
 * because the feature flag is off) — the Rust side denies such a request on its own 60s callback
 * timeout, but nothing reports that back over IPC, so an unresolved row is the honest rendering.
 */
export const AgentAccessRequestStatus = Object.freeze({
  /** Handed to the renderer; no decision yet. */
  Pending: "pending",
  /** The user approved, and the selected item's fields were released. */
  Shared: "shared",
  /** The user (or an automatic gate — feature disabled, unlock timeout, lookup error) said no. */
  Denied: "denied",
  /** Nothing in the vault matched the query, so no approval dialog was ever shown. */
  NotFound: "not_found",
  /**
   * The user approved an `operation: "create"` request and a new Secrets Manager secret was
   * created (agent-access-architecture.md, "M4b — secret creation"). The SM-analogue of
   * `Shared` for a write instead of a read; `secretId` is copied onto the row the same way.
   */
  Created: "created",
  /**
   * The user approved an `operation: "update"` request and the target secret or project was
   * updated (agent-access-architecture.md, "M6"). `secretId`/`projectId` is copied onto the row
   * like `Created`.
   */
  Updated: "updated",
  /**
   * The user approved an `operation: "delete"` request and the target was deleted — soft
   * (SM trash) for secrets, hard for projects (agent-access-architecture.md, "M6").
   * `secretId`/`projectId` is copied onto the row like `Created`.
   */
  Deleted: "deleted",
  /**
   * The user approved an `operation: "list"` request and the readable project list (names, ids,
   * write flags — no secret material) was released in one approval (M6's sole list-shaped
   * release). No target id is copied: the row records that the list itself was shared.
   */
  Listed: "listed",
  /**
   * The user approved a `deliveryMode: "fill"` request and the browser extension filled at
   * least one field (agent-access-architecture.md, "M5 — Browser fill delivery"). The fill
   * analogue of `Shared`: `cipherId` and `fieldsShared` (the roles actually filled) are copied
   * onto the row the same way, plus the extension-reported page origin (`fillOrigin`).
   */
  Filled: "filled",
  /**
   * The user approved a `deliveryMode: "fill"` request but no field was filled — the extension
   * disappeared after approval, the page changed under the plan (`target-changed`/
   * `origin-changed`), or every field outcome came back skipped/failed. Distinct from `Denied`
   * (the user said yes; execution failed) so the audit trail never misstates an approval as a
   * refusal (M5: "approved = user approved; fill carries execution outcome").
   */
  FillFailed: "fill_failed",
} as const);
export type AgentAccessRequestStatus =
  (typeof AgentAccessRequestStatus)[keyof typeof AgentAccessRequestStatus];

/** Discriminator for the {@link AgentAccessActivityEntry} union. */
export const AgentAccessActivityType = Object.freeze({
  /** One credential request and its outcome, collapsed into a single row. */
  CredentialRequest: "credential_request",
  /** A connection/transport event forwarded from the Rust agent. */
  Lifecycle: "lifecycle",
} as const);
export type AgentAccessActivityType =
  (typeof AgentAccessActivityType)[keyof typeof AgentAccessActivityType];

/** Which ingress a credential request arrived through. Mirrors napi's `CredentialRequestOrigin`. */
export const AgentAccessActivityOrigin = Object.freeze({
  Relay: "relay",
  Local: "local",
} as const);
export type AgentAccessActivityOrigin =
  (typeof AgentAccessActivityOrigin)[keyof typeof AgentAccessActivityOrigin];

interface AgentAccessActivityBase {
  /** Stable across the entry's lifetime, so a resolution can update the row it opened. */
  id: string;
  /** Unix epoch milliseconds, stringified to match the napi event contract. */
  timestampMs: string;
  /** Resolved agent name — the paired connection's name, or the attested local process. */
  agentName?: string;
  agentFingerprint?: string;
}

/**
 * One credential request, from dispatch to outcome.
 *
 * SECURITY: contains no decrypted Vault Data at all. It carries the *query* (agent-supplied), the
 * outcome, and — for an approved request — the released item's **id**, never its name. The name is
 * resolved for display from the unlocked vault at render time, so a locked vault has nothing to
 * redact and a switched account resolves nothing. This mirrors the `bw://item/<id>` reference model
 * the wire protocol already uses (agent-access-architecture.md: a reference "carries no secret
 * values by construction"). No password, TOTP code, or note ever reaches this type either.
 */
export interface CredentialRequestActivity extends AgentAccessActivityBase {
  type: typeof AgentAccessActivityType.CredentialRequest;
  origin: AgentAccessActivityOrigin;
  /**
   * Absent for an `operation: "create"` row (agent-access-architecture.md, "M4b"): napi's
   * `queryValue` field isn't optional, so the Rust side populates it with the *proposed secret
   * name* for a create request — recording it here would put a secret name in the persisted
   * main-process activity buffer, which stores ids only (see `MainAgentAccessService`'s
   * `openCredentialRequest`). Present for every `"request"` row, which is why the field stays
   * required-looking everywhere except the create path.
   */
  queryType?: CredentialQueryType;
  /** What the agent asked for, verbatim: a domain, an item id, or a search term. Absent for an
   *  `operation: "create"` row — see `queryType`'s doc for why. */
  queryValue?: string;
  status: AgentAccessRequestStatus;
  /**
   * Whether this request asked for a login credential or a Secrets Manager secret. Mirrors napi's
   * `ResourceType`; defaults to {@link AgentAccessResourceType.Credential} when absent (older
   * requests, or a narrowing failure) — see `toAgentAccessResourceType`.
   */
  resourceType?: AgentAccessResourceType;
  /**
   * Whether this row is a vault/SM lookup or a Secrets Manager secret *creation*
   * (agent-access-architecture.md, "M4b"). Mirrors napi's `OperationType`; defaults to
   * {@link AgentAccessOperation.Request} when absent (older rows, or a narrowing failure) — see
   * `toAgentAccessOperation`.
   */
  operation?: AgentAccessOperation;
  /**
   * Id of the vault item whose fields were released — an opaque identifier, not vault content, and
   * one the requesting agent already holds. Only ever set alongside
   * {@link AgentAccessRequestStatus.Shared}. Resolve it to a name via the vault, never store one.
   */
  cipherId?: string;
  /**
   * Id of the Secrets Manager secret whose value was released, or — for
   * {@link AgentAccessRequestStatus.Created} — the newly-created secret's id. An opaque
   * identifier, not vault content. Only ever set alongside `Shared` or `Created`, and only for
   * {@link AgentAccessResourceType.Secret} requests.
   */
  secretId?: string;
  /**
   * Id of the Secrets Manager project a `Created`/`Updated`/`Deleted` row targeted, for
   * {@link AgentAccessResourceType.Project} requests (M6) — or, for an
   * `operation: "bulkRequest"` row (M7), of the project whose secret set was released. An
   * opaque identifier — names resolve at render time from the renderer-side project name
   * cache, ids-only invariant unchanged.
   */
  projectId?: string;
  /**
   * Ids of the Secrets Manager secrets released by an approved `operation: "bulkRequest"` row
   * (M7, `projectSecretsRequest`) — the enumerated set the user saw in the approval dialog.
   * Opaque identifiers only; names resolve at render time from the renderer-side cache, and the
   * row's `projectId` names the project they came from. Only ever set alongside
   * {@link AgentAccessRequestStatus.Shared}.
   */
  secretIds?: string[];
  /** Which fields were released, e.g. `["username", "password"]`. Never their values. */
  fieldsShared?: string[];
  /**
   * Extension-reported page origin a `deliveryMode: "fill"` request filled into (or tried to),
   * e.g. `https://github.com` (agent-access-architecture.md, "M5"). Metadata, not vault content —
   * it comes from the extension's own report of the active tab, never from the vault or the
   * requester. Only ever set alongside {@link AgentAccessRequestStatus.Filled} or
   * {@link AgentAccessRequestStatus.FillFailed}.
   */
  fillOrigin?: string;
  /** When the request was resolved; unset while `Pending`. */
  resolvedAtMs?: string;
}

/** A connection/transport event forwarded verbatim from the Rust agent's audit stream. */
export interface LifecycleActivity extends AgentAccessActivityBase {
  type: typeof AgentAccessActivityType.Lifecycle;
  /** The Rust `AgentAccessEvent.kind`, e.g. `"connection_established"`. */
  kind: string;
  /** Free-form context from Rust, e.g. `"rendezvous"` or a reconnect attempt number. */
  detail?: string;
}

export type AgentAccessActivityEntry = CredentialRequestActivity | LifecycleActivity;

/**
 * What the renderer's outcome answer contributes to an open {@link CredentialRequestActivity}.
 *
 * Sent alongside — never derived from — the credential response payload: that payload may carry a
 * live password, and nothing from it is ever copied into the activity buffer.
 */
export interface CredentialRequestOutcome {
  status: AgentAccessRequestStatus;
  cipherId?: string;
  /** Id of the released, newly-created, updated, or deleted Secrets Manager secret. Only
   *  meaningful alongside a `Shared`, `Created`, `Updated`, or `Deleted` status. */
  secretId?: string;
  /** Id of the created/updated/deleted Secrets Manager project — see
   *  {@link CredentialRequestActivity.projectId} — or, for an `operation: "bulkRequest"` row
   *  (M7), of the project whose secret set was released. */
  projectId?: string;
  /** Ids of the secrets a `bulkRequest` release covered — see
   *  {@link CredentialRequestActivity.secretIds}. Only meaningful alongside `Shared`. */
  secretIds?: string[];
  fieldsShared?: string[];
  /** Extension-reported page origin of a fill attempt — see
   *  {@link CredentialRequestActivity.fillOrigin}. Only meaningful alongside a `Filled` or
   *  `FillFailed` status. */
  fillOrigin?: string;
  /** Present for symmetry with {@link CredentialRequestActivity.operation}; the row's own
   *  `operation` (set when it was opened) is authoritative, so this is never read to decide
   *  behavior — only carried for callers that want to assert it matches. */
  operation?: AgentAccessOperation;
}
