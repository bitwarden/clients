import { Injector, afterNextRender } from "@angular/core";

/**
 * Moves focus to whatever `target` resolves to once the pending change has rendered.
 * For a control that removes itself when activated, focus would otherwise fall to the body.
 */
export function focusAfterRender(
  injector: Injector,
  target: () => HTMLElement | null | undefined,
): void {
  afterNextRender(() => target()?.focus(), { injector });
}
