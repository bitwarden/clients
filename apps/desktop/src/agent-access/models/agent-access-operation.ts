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
 * delivery"). Always `Request` on the relay path — creates and describe-target requests are
 * local-transport-only, same restriction as `resourceType: "secret"`.
 */
export const AgentAccessOperation = Object.freeze({
  Request: "request",
  Create: "create",
  /**
   * Approval-free, vault-free, unlock-free page description (M5): the renderer round-trips to
   * the browser extension and replies with the active tab's login surface — no vault data is
   * ever touched, no activity row is opened, and no dialog is shown.
   */
  DescribeFillTarget: "describeFillTarget",
} as const);
export type AgentAccessOperation = (typeof AgentAccessOperation)[keyof typeof AgentAccessOperation];
