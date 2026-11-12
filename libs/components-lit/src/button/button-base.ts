import { PropertyValues } from "lit";
import { property, query, state } from "lit/decorators.js";

import { AriaTargetHost } from "../core/aria";
import { AsyncHandler, runAsyncAction } from "../core/async-action";
import { BitElement } from "../core/bit-element";

import { BUTTON_SPINNER_DELAY_MS, ButtonType } from "./button-styles";
import { activateFormButton } from "./form-button";

/**
 * Shared behavior for `bit-button` and `bit-icon-button`: form association, `aria-disabled`
 * click blocking, debounced loading spinner, and async `action` handlers.
 */
export abstract class BitButtonBase extends BitElement implements AriaTargetHost {
  static formAssociated = true;

  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  protected readonly internals = this.attachInternals();

  @property({ attribute: "button-type", reflect: true }) abstract buttonType: ButtonType;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Shows a spinner (after a short delay) and blocks clicks. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Show the spinner as soon as `loading` starts, for actions that block the main thread. */
  @property({ type: Boolean, attribute: "instant-spinner" }) instantSpinner = false;

  /** Native button type. Defaults to `"button"`; set `"submit"` to submit the enclosing form. */
  @property() type: "button" | "submit" | "reset" = "button";

  @property() name?: string;

  @property() value?: string;

  /**
   * Async click handler. The button shows `loading` until the returned promise settles. Errors are
   * routed to the handler registered with `setAsyncActionErrorHandler`.
   */
  @property({ attribute: false }) action?: AsyncHandler;

  @state() protected showSpinner = false;

  @query("button, a") readonly ariaTarget!: HTMLElement | null;

  private spinnerTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    // Capture so consumer `click` listeners on the host never see clicks on a disabled button.
    this.addEventListener("click", this.onHostClick, { capture: true });
  }

  get form() {
    return this.internals.form;
  }

  protected get isInactive() {
    return this.disabled || this.loading;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("loading")) {
      clearTimeout(this.spinnerTimer);
      if (!this.loading || this.instantSpinner) {
        this.showSpinner = this.loading;
      } else {
        this.spinnerTimer = setTimeout(() => (this.showSpinner = true), BUTTON_SPINNER_DELAY_MS);
      }
    }
  }

  private onHostClick = (event: MouseEvent) => {
    if (this.isInactive) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  protected onClick = async () => {
    if (this.isInactive) {
      return;
    }
    if (this.action) {
      await runAsyncAction(this.action, (loading) => (this.loading = loading));
    }
    activateFormButton(this.form, this.type, { name: this.name, value: this.value });
  };
}
