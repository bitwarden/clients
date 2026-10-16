import type { CipherAccessStateView } from "../abstractions/access-lease";

/**
 * "Ending soon" derives from the live countdown, so `active` carries only `expiresAt`.
 * {@link cipherAccessBadgeState} never produces `expired`; the badge falls back to it when an
 * active lease lapses locally. `unavailable` comes from the SDK, off the server's
 * `heldByAnotherUser` flag; the holder is never named.
 */
export type AccessBadgeState =
  | { readonly kind: "privileged" | "pending" | "unavailable" | "ready" | "expired" }
  | { readonly kind: "active"; readonly expiresAt: Date };

/**
 * Remaining time at or below which an active lease escalates to "ending soon". Shared by the
 * badge and the cipher-view banner's countdown so the two escalate together.
 */
export const ENDING_SOON_THRESHOLD_MS = 5 * 60 * 1000;

export const ACCESS_BADGE_LOOK = Object.freeze({
  privileged: { icon: "bwi-key", variant: "primary" },
  pending: { icon: "bwi-clock", variant: "warning" },
  unavailable: { icon: "bwi-lock", variant: "subtle" },
  ready: { icon: "bwi-check", variant: "success" },
  expired: { icon: "bwi-lock", variant: "subtle" },
  active: { icon: "bwi-unlock", variant: "accent-primary" },
  endingSoon: { icon: "bwi-exclamation-triangle", variant: "danger" },
} as const);

/**
 * Adapts the SDK's `badgeState` onto {@link AccessBadgeState}. The SDK ranks the states (active →
 * ready → pending → unavailable → privileged), so every client badges a gated item identically.
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
