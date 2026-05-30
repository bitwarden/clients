/**
 * Lifecycle events delivered to credential-leasing requesters over the server
 * push channel.
 *
 * v0 covers only the two terminal verdicts a requester needs to react to in
 * real time:
 *
 * - `approved` — the request was approved into a redeemable ticket; the
 *   consumer should re-fetch to pick up the approved ticket (the push payload
 *   deliberately does not carry vault data). No lease exists yet.
 * - `denied` — the request was denied; the consumer can flip UI to the
 *   denial state without a follow-up fetch.
 * - `activated` — an approved ticket was redeemed and a {@link LeaseResponse}
 *   was minted; the consumer should re-fetch to pick up the active lease.
 * - `expired` — the request lapsed (pending decision deadline, or an
 *   unredeemed ticket's redemption window) or its lease reached `not_after`.
 * - `revoked` — the lease was ended early (by its grantee, an approver, or the
 *   org-wide kill switch).
 * - `cancelled` — the requester withdrew a still-pending request.
 *
 * The server push contract (PM-37262) covers only `approved` / `denied` today;
 * the remaining kinds are emitted by the in-process mock so that the cipher
 * banner re-renders on every state transition. {@link DefaultLeaseEventService}
 * maps unknown wire kinds to `null`, so adding kinds here is forward-compatible.
 */
export const LeaseEventKind = Object.freeze({
  Approved: "approved",
  Denied: "denied",
  Activated: "activated",
  Expired: "expired",
  Revoked: "revoked",
  Cancelled: "cancelled",
} as const);
export type LeaseEventKind = (typeof LeaseEventKind)[keyof typeof LeaseEventKind];

/**
 * A push-delivered lifecycle event for a single {@link AccessRequestResponse}.
 */
export type LeaseEvent = {
  readonly kind: LeaseEventKind;
  readonly requestId: string;
};
