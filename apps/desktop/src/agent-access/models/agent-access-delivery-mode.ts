/**
 * Mirrors the Rust `agent_access::DeliveryMode` const enum (see
 * `apps/desktop/desktop_native/napi/index.d.ts`). That type is declared `const enum` in an
 * ambient `.d.ts` with no runtime JS object backing it, so the string literals are duplicated
 * here for use in TS/Angular code (comparisons, display copy, template bindings) — same
 * hand-mirror discipline as `AgentAccessResourceType`/`AgentAccessOperation`. Keep the values in
 * sync with the napi contract.
 *
 * How the requester wants an approved credential delivered. Only ever present for
 * `origin: "local"` requests — the relay path has no delivery mode.
 */
export const AgentAccessDeliveryMode = Object.freeze({
  /** Values returned to the requester for exec-injection, never printed. */
  Inject: "inject",
  /** No secret values in the reply, ever — a `bw://item/<id>` reference only. */
  Reference: "reference",
  /**
   * Browser fill delivery (agent-access-architecture.md, "M5"): the credential value never
   * crosses the napi boundary at all — the renderer resolves it and pushes it directly to the
   * browser extension; the agent receives only a status, a reference, and per-field outcomes.
   * Credential resource only.
   */
  Fill: "fill",
} as const);
export type AgentAccessDeliveryMode =
  (typeof AgentAccessDeliveryMode)[keyof typeof AgentAccessDeliveryMode];
