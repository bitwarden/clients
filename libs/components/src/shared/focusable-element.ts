/**
 * Interface for implementing focusable components.
 *
 * Used by the `AutofocusDirective` and `A11yGridDirective`.
 */
export abstract class FocusableElement {
  abstract getFocusTarget(): HTMLElement | undefined;
}
