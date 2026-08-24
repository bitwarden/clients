import { Injector, afterNextRender } from "@angular/core";

/**
 * Moves focus to whatever `target` resolves to once the pending change has rendered.
 *
 * For a control that removes itself when activated — a Clear button that only exists
 * while there is something to clear, a dismiss button gated on being active — the
 * browser drops focus to the document body as the element leaves the DOM, stranding
 * keyboard and screen reader users. Call this alongside the state change to hand focus
 * to a control that survives it.
 */
export function focusAfterRender(
  injector: Injector,
  target: () => HTMLElement | null | undefined,
): void {
  afterNextRender(() => target()?.focus(), { injector });
}
