/**
 * Mirrors the Rust `agent_access::OperationType` const enum (see
 * `apps/desktop/desktop_native/napi/index.d.ts`). That type is declared `const enum` in an
 * ambient `.d.ts` with no runtime JS object backing it, so the string literals are duplicated
 * here for use in TS/Angular code (comparisons, display copy, template bindings) — same
 * hand-mirror discipline as `AgentAccessResourceType`/`CredentialQueryType`. Keep the values in
 * sync with the napi contract.
 *
 * Whether a `CredentialRequestData` is asking to look up existing vault data (`Request`, the
 * only operation before M4b), to create a new Secrets Manager secret (`Create`,
 * agent-access-architecture.md "M4b — secret creation"), or to describe the active browser
 * tab's fillable fields (`DescribeFillTarget`, agent-access-architecture.md "M5 — Browser fill
 * delivery"). M6 adds the remaining Secrets Manager writes (`Update`, `Delete`) and the
 * project-list release (`List`) — see agent-access-architecture.md "M6 — Full Secrets Manager
 * surface". Always `Request` on the relay path — every other operation is local-transport-only,
 * same restriction as `resourceType: "secret"`.
 */
export const AgentAccessOperation = Object.freeze({
  Request: "request",
  Create: "create",
  /** Update an existing SM secret or rename a project (M6). Single target, never bulk. */
  Update: "update",
  /** Delete a single SM secret (soft, to trash) or project (hard, orphans secrets) (M6). */
  Delete: "delete",
  /** Release the readable SM project list (names/ids/write flags only) in one approval (M6). */
  List: "list",
  /**
   * Release ALL secrets of one project for env injection into one command (M7,
   * `projectSecretsRequest`) — the sole bulk read; the approval dialog enumerates every
   * secret name being released, and the activity row keeps ids only (`secretIds`).
   */
  BulkRequest: "bulkRequest",
  /**
   * Approval-free, vault-free, unlock-free page description (M5): the renderer round-trips to
   * the browser extension and replies with the active tab's login surface — no vault data is
   * ever touched, no activity row is opened, and no dialog is shown.
   */
  DescribeFillTarget: "describeFillTarget",
  /**
   * An OpenShell gateway resolving one provider's `bw://` references (agent-access-architecture
   * .md, §M8). Only ever paired with origin `"openshell"`; every other pairing is denied.
   */
  ProviderResolve: "providerResolve",
} as const);
export type AgentAccessOperation = (typeof AgentAccessOperation)[keyof typeof AgentAccessOperation];
