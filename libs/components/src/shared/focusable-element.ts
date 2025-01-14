// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
/**
 * Interface for implementing focusable components.
 *
 * Used by the `AutofocusDirective` and `A11yGridDirective`.
 */
export abstract class FocusableElement {
  getFocusTarget: () => HTMLElement;
}
