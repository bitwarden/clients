/**
 * Lifecycle events delivered to credential-leasing requesters over the server
 * push channel.
 *
 * v0 covers only the two terminal verdicts a requester needs to react to in
 * real time:
 *
 * - `approved` — the request was approved; the consumer should re-fetch to
 *   pick up the new {@link LeaseResponse} (the push payload deliberately
 *   does not carry vault data).
 * - `denied` — the request was denied; the consumer can flip UI to the
 *   denial state without a follow-up fetch.
 *
 * Out of scope for v0 (email-only): `lease_revoked`, `lease_expiring_soon`,
 * and any approver-side notifications.
 */
export const LeaseEventKind = Object.freeze({
  Approved: "approved",
  Denied: "denied",
} as const);
export type LeaseEventKind = (typeof LeaseEventKind)[keyof typeof LeaseEventKind];

/**
 * A push-delivered lifecycle event for a single {@link LeaseRequestResponse}.
 */
export type LeaseEvent = {
  readonly kind: LeaseEventKind;
  readonly requestId: string;
};
