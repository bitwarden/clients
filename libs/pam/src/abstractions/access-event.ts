/**
 * Lifecycle events delivered to credential-leasing requesters over the server
 * push channel.
 *
 * v0 covers only the two terminal verdicts a requester needs to react to in
 * real time:
 *
 * - `approved` — the request was approved into an activatable approved request; the
 *   consumer should re-fetch to pick up the approved request (the push payload
 *   deliberately does not carry vault data). No lease exists yet.
 * - `denied` — the request was denied; the consumer can flip UI to the
 *   denial state without a follow-up fetch.
 * - `activated` — an approved request was activated and a {@link AccessLeaseResponse}
 *   was minted; the consumer should re-fetch to pick up the active lease.
 * - `expired` — the request lapsed (pending decision deadline, or an
 *   unactivated approved request's activation window) or its lease reached `not_after`.
 * - `revoked` — the lease was ended early (by its grantee, an approver, or the
 *   org-wide kill switch).
 * - `cancelled` — the requester withdrew a still-pending request.
 *
 * The server push contract (PM-37262) covers only `approved` / `denied` today;
 * the remaining kinds are emitted by the in-process mock so that the cipher
 * banner re-renders on every state transition. {@link DefaultAccessEventService}
 * maps unknown wire kinds to `null`, so adding kinds here is forward-compatible.
 */
export const AccessEventKind = Object.freeze({
  Approved: "approved",
  Denied: "denied",
  Activated: "activated",
  Expired: "expired",
  Revoked: "revoked",
  Cancelled: "cancelled",
} as const);
export type AccessEventKind = (typeof AccessEventKind)[keyof typeof AccessEventKind];

/**
 * A push-delivered lifecycle event for a single {@link AccessRequestDetailsResponse}.
 */
export type AccessEvent = {
  readonly kind: AccessEventKind;
  readonly requestId: string;
};
