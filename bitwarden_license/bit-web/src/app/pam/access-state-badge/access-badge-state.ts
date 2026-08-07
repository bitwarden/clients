import type { CipherAccessStateView } from "../abstractions/access-lease";

/**
 * The unified access-state badge model, per the "Unifying access-state badges consistently
 * across vault, modal, and Requests page" spec (Figma node 88-1699). Every surface that shows
 * an access-state pill renders it from this one model via {@link AccessStateBadgeComponent}, so
 * the recipe (colour + icon + copy) and the countdown escalation stay identical everywhere.
 *
 * Exactly one badge shows for a gated item at a time. The escalation between the accent
 * "N left" badge and the danger "Ending soon" badge is a function of the live countdown, not a
 * separate state — so `active` carries only `expiresAt` and the component derives the rest.
 *
 * `unavailable` (the item is held by another user) is part of the model for completeness but is
 * NOT yet produced by {@link cipherAccessBadgeState}: `CipherAccessStateView` is caller-scoped
 * and never reports someone else's lease. Producing it needs an SDK + server change — see the
 * tracked follow-up.
 */
export type AccessBadgeState =
  | { readonly kind: "privileged" | "pending" | "unavailable" | "ready" | "expired" }
  | { readonly kind: "active"; readonly expiresAt: Date };

/**
 * Resolve the single badge to show for a gated cipher from its caller-scoped access state,
 * applying the spec's precedence (highest-ranked true state wins):
 *
 *   active lease  →  approved (ready to use)  →  pending approval  →  privileged (resting)
 *
 * The `active` → `Ending soon` escalation is left to the component (it is a countdown threshold,
 * not a distinct state). `unavailable` is intentionally not resolved here (see {@link AccessBadgeState}).
 * Returns `null` when there is nothing to badge (e.g. the cipher is not gated).
 */
export function cipherAccessBadgeState(
  state: CipherAccessStateView | null | undefined,
): AccessBadgeState | null {
  if (state == null) {
    return null;
  }
  if (state.activeLease != null) {
    return { kind: "active", expiresAt: new Date(state.activeLease.notAfter) };
  }
  if (state.approvedRequest != null) {
    return { kind: "ready" };
  }
  if (state.pendingRequest != null) {
    return { kind: "pending" };
  }
  // Resting state for any gated item with no request or lease in play.
  return { kind: "privileged" };
}
