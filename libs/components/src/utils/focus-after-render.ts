import { Injector, afterNextRender } from "@angular/core";

/**
 * Moves focus to whatever `target` resolves to once the pending change has rendered.
 *
 * For a control that removes itself when activated, the browser drops focus to the
 * document body as the element leaves the DOM. Call this alongside the state change to
 * hand focus to a control that survives it.
 */
export function focusAfterRender(
  injector: Injector,
  target: () => HTMLElement | null | undefined,
): void {
  afterNextRender(() => target()?.focus(), { injector });
}
