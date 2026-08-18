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
 * `unavailable` (the item is held by another user) and `expired` are part of the model for
 * completeness but are NOT produced by {@link cipherAccessBadgeState}: the SDK deliberately does
 * not model either, because the per-cipher access-state response is caller-scoped and there is no
 * data to derive them from. Producing them needs a server response-model change plus a new SDK
 * field — see the tracked follow-up.
 */
export type AccessBadgeState =
  | { readonly kind: "privileged" | "pending" | "unavailable" | "ready" | "expired" }
  | { readonly kind: "active"; readonly expiresAt: Date };

/**
 * Adapt the SDK's `badgeState` onto the presentation model above.
 *
 * The precedence — active lease → approved (ready to activate) → pending → privileged (resting) —
 * is applied ONCE in the SDK, where the access-state response is converted, so every client badges
 * a gated item identically instead of each reimplementing the ranking. This function only
 * translates the shape: the SDK spells the active case as a `{ active: { expiresAt } }` variant
 * carrying an ISO timestamp, while the badge component wants a `kind` discriminant and a parsed
 * `Date`.
 *
 * Returns `null` when there is no state to badge (e.g. the cipher is not gated).
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
