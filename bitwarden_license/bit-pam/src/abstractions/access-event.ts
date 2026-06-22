/**
 * DEMO ONLY — the kinds the in-process PAM mock store fires as it simulates a
 * request/lease lifecycle, so the cipher banner and "My requests" page re-render
 * on every transition.
 *
 * In production there is no per-kind wire contract: the server fires a single
 * {@link NotificationType.RefreshAccessRequest} push carrying no vault data, and
 * {@link DefaultAccessEventService} surfaces it as a bare "re-fetch your access
 * state" tick (`accessChanged$`). These kinds are not produced by any server
 * code; they exist only to drive the mock.
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
