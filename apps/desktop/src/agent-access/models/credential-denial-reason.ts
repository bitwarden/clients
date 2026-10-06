/**
 * Why a credential request was denied without ever reaching the agent's requested value,
 * distinguishing "nothing matched the query" from "the user (or an automatic gate, e.g. the
 * unlock timeout) said no" — and, for `deliveryMode: "fill"` requests (M5), the two mechanical
 * pre-prompt refusals. Surfaced in the `reason` field of the object passed to
 * `ipc.agentAccess.credentialRequestResponse` and mapped to the local protocol's `status` by the
 * Rust side.
 *
 * Mirrors the reason strings napi's `agent_access.CredentialResponseData.reason` documents (see
 * `apps/desktop/desktop_native/napi/index.d.ts`) — plain strings with no runtime enum backing
 * them, so the literals are duplicated here under the same hand-mirror discipline as
 * `AgentAccessOperation` and siblings. The Rust side tolerates the legacy `"not_found"` spelling
 * too, but this TS side standardizes on camelCase.
 */
export const CredentialDenialReason = Object.freeze({
  /** No active login cipher (or readable Secrets Manager secret) matched the request's query. */
  NotFound: "notFound",
  /** The user explicitly rejected the approval dialog, or an automatic gate denied on their
   *  behalf (feature disabled, unlock timeout, lookup error). */
  Denied: "denied",
  /** A non-user failure the requester can act on — e.g. the browser extension is not connected
   *  (or several are) for a `deliveryMode: "fill"` request. Never reported as "Denied by user". */
  Error: "error",
  /**
   * M5 mechanical refusal, no dialog shown (invariant 10): no resolved item's saved URIs match
   * the extension-reported active-tab origin. `denialDetail` carries that origin — never any
   * item name.
   */
  OriginMismatch: "originMismatch",
  /**
   * M5 mechanical refusal, no dialog shown: the origin matched but no requested field role has a
   * §4.1-safe target on the page. `denialDetail` carries the machine-readable refusal reason
   * (e.g. `looks-like-registration`).
   */
  NoSafeTarget: "noSafeTarget",
  /** The vault is locked; the user was never asked (mapped to the wire's `locked`). */
  Locked: "locked",
  /** The approval dialog's own countdown ran out (§M8.4, OpenShell). Never a user decision. */
  Timeout: "timeout",
} as const);
export type CredentialDenialReason =
  (typeof CredentialDenialReason)[keyof typeof CredentialDenialReason];
