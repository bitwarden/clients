import type { CipherAccessStateView } from "../abstractions/access-lease";

/**
 * "Ending soon" derives from the live countdown, so `active` carries only `expiresAt`.
 * {@link cipherAccessBadgeState} never produces `unavailable` or `expired`, since the
 * caller-scoped access-state response has no data for either.
 */
export type AccessBadgeState =
  | { readonly kind: "privileged" | "pending" | "unavailable" | "ready" | "expired" }
  | { readonly kind: "active"; readonly expiresAt: Date };

/**
 * Remaining time at or below which an active lease escalates to "ending soon". Shared by the
 * badge and the cipher-view banner's countdown so the two escalate together.
 */
export const ENDING_SOON_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Adapts the SDK's `badgeState` onto {@link AccessBadgeState}. The SDK ranks the states, so every
 * client badges a gated item identically.
 */
export function cipherAccessBadgeState(
  state: CipherAccessStateView | null | undefined,
): AccessBadgeState | null {
  if (state == null) {
    return null;
  }
  const badge = state.badgeState;
  return typeof badge === "string"
    ? { kind: badge }
    : { kind: "active", expiresAt: new Date(badge.active.expiresAt) };
}
