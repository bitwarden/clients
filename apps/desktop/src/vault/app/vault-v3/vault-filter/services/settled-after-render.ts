import { afterNextRender, signal } from "@angular/core";

/**
 * A signal that flips to `true` only after the calling component's first render commits.
 *
 * `bit-nav-group` can force itself (or a whole ancestor chain) open during construction —
 * e.g. its route-matching effect, or a child cascading `open` up to its parents — before a user
 * could possibly have clicked anything. Gating persistence writes on this avoids mistaking that
 * lifecycle-driven open for a genuine user action and overwriting a saved collapsed preference.
 */
export function settledAfterRender() {
  const settled = signal(false);
  afterNextRender(() => settled.set(true));
  return settled;
}
