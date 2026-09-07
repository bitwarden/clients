import type { CipherAccessStateView } from "../abstractions/access-lease";

/**
 * The unified access-state badge model, per Figma node 88-1699. Every surface showing an
 * access-state pill renders it from this one model via {@link AccessStateBadgeComponent}, so
 * the recipe and countdown escalation stay identical everywhere.
 *
 * Exactly one badge shows at a time. The escalation between "N left" and "Ending soon" is a
 * function of the live countdown, not a separate state, so `active` carries only `expiresAt`.
 *
 * `unavailable` and `expired` are part of the model for completeness but are NOT produced by
 * {@link cipherAccessBadgeState}: the per-cipher access-state response is caller-scoped, with no
 * data to derive either from.
 */
export type AccessBadgeState =
  | { readonly kind: "privileged" | "pending" | "unavailable" | "ready" | "expired" }
  | { readonly kind: "active"; readonly expiresAt: Date };

/**
 * Adapt the SDK's `badgeState` onto the presentation model above.
 *
 * Precedence — active lease → approved → pending → privileged — is applied once in the SDK, so
 * every client badges a gated item identically; this only translates the shape, from the SDK's
 * `{ active: { expiresAt } }` variant to a `kind` discriminant and a parsed `Date`.
 *
 * Returns `null` when there is no state to badge (e.g. the cipher isn't gated).
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
