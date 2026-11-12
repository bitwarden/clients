/**
 * An element's height as a collapsing region, which never reports less than its expanded height.
 *
 * `ScrollDirectionTracker`'s `minScrollable` gates a collapse on the scroller being able to afford
 * it, so under-reporting is the dangerous direction — a plain `offsetHeight` measures ~0 once
 * collapsed and something in between while animating open. The last settled height stands in for
 * both.
 *
 * Measured on each call rather than cached, so content that appears later is reflected
 * immediately; the settled height is re-taken after any transition that finishes while expanded,
 * which lets it correct back down once the content shrinks.
 */
export function settledHeight(
  host: HTMLElement,
  expanded: () => boolean,
): { measure(): number; destroy(): void } {
  // An element never transitions on its first style resolution, so it starts out settled.
  let settled = expanded() ? host.offsetHeight : 0;

  const onTransitionEnd = (event: TransitionEvent) => {
    // `transitionend` bubbles, and a descendant's transition (a chip's colors) can land while the
    // region is still animating open, when the host height is only an intermediate value.
    if (event.target === host && expanded()) {
      settled = host.offsetHeight;
    }
  };
  host.addEventListener("transitionend", onTransitionEnd);

  return {
    measure: () => (expanded() ? Math.max(host.offsetHeight, settled) : settled),
    destroy: () => host.removeEventListener("transitionend", onTransitionEnd),
  };
}
