/**
 * Interface for implementing focusable components.
 *
 * Used by the `AutofocusDirective`.
 */
export abstract class FocusableElement {
  abstract getFocusTarget(): HTMLElement | undefined;
}
