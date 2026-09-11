import { PositionStrategy } from "@angular/cdk/overlay";
import { InjectionToken, Signal } from "@angular/core";

/**
 * Where a dialog is currently anchored in the viewport.
 *
 * - `center` — centered vertically and horizontally
 * - `bottom` — docked to the bottom edge, as a mobile bottom sheet
 */
export type DialogPosition = "center" | "bottom";

/**
 * A position strategy a dialog can be opened with. Strategies that move the dialog around the
 * viewport should report where they placed it, so dialog content can adapt to its own placement
 * — e.g. animating in from the bottom of the screen rather than the top. `DialogService` passes
 * that signal to the dialog as {@link DIALOG_POSITION}.
 *
 * `position` is optional because CDK's own strategies don't report one; they are treated as
 * centered.
 */
export interface DialogPositionStrategy extends PositionStrategy {
  readonly position?: Signal<DialogPosition>;
}

/**
 * The position of the dialog that this component is rendered in, kept up to date as the
 * viewport changes. Provided by `DialogService` when the dialog's position strategy reports its
 * position.
 *
 * Inject optionally: the token is absent for dialogs opened with a strategy that doesn't report
 * a position, and for dialogs rendered outside of `DialogService`. Absent means centered.
 *
 * @see {@link DialogPositionStrategy}
 */
export const DIALOG_POSITION = new InjectionToken<Signal<DialogPosition>>("DialogPosition");
