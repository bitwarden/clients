import { PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

import { BitElement } from "./bit-element";
import { errorMessage, ValidationErrors, Validator, Validators } from "./validators";

/**
 * Base for form-associated controls. Participates in native `<form>` submission, reset, disabled
 * fieldsets and constraint validation via `ElementInternals`, and runs `Validators`.
 *
 * Subclasses own `value`, call `setValue()` on user input, and return the element to anchor
 * validation bubbles to from `validationTarget`.
 */
export abstract class BitFormControlElement<V = string> extends BitElement {
  static formAssociated = true;

  protected readonly internals = this.attachInternals();

  /** Submitted with the form under this name. */
  @property({ reflect: true }) name = "";

  @property({ type: Boolean, reflect: true }) disabled = false;

  @property({ type: Boolean, reflect: true }) required = false;

  /** Extra validation, e.g. `[Validators.email, Validators.maxLength(50)]`. */
  @property({ attribute: false }) validators: Validator<V>[] = [];

  /** Set after the user blurs the control. Errors are shown once touched or after a submit attempt. */
  @state() touched = false;

  @state() dirty = false;

  @state() protected submitAttempted = false;

  @state() protected formDisabled = false;

  abstract value: V;

  protected abstract get validationTarget(): HTMLElement | undefined;

  private initialValue?: V;

  get form() {
    return this.internals.form;
  }

  get errors(): ValidationErrors | null {
    const validators = this.required
      ? [Validators.required as Validator<V>, ...this.validators]
      : this.validators;
    const errors = validators.reduce<ValidationErrors>(
      (acc, validate) => ({ ...acc, ...validate(this.value) }),
      {},
    );
    return Object.keys(errors).length ? errors : null;
  }

  get invalid() {
    return this.errors !== null;
  }

  get isDisabled() {
    return this.disabled || this.formDisabled;
  }

  /** Whether the error message should be displayed. */
  get showErrors() {
    return this.invalid && !this.isDisabled && (this.touched || this.submitAttempted);
  }

  get errorMessage() {
    return errorMessage(this.errors);
  }

  checkValidity() {
    return this.internals.checkValidity();
  }

  reportValidity() {
    this.submitAttempted = true;
    return this.internals.reportValidity();
  }

  /** Marks the control touched so errors display, e.g. before programmatic submit. */
  markAsTouched() {
    this.touched = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initialValue = this.value;
    this.addEventListener("invalid", this.onInvalid);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("invalid", this.onInvalid);
  }

  /**
   * Call from user input handlers. Pass `normalize: false` for per-keystroke updates so normalizing
   * validators like `trim` only run when the value is committed.
   */
  protected setValue(value: V, { emitChange = true, normalize = true } = {}) {
    if (normalize) {
      for (const validator of this.validators) {
        if (validator.normalize) {
          value = validator.normalize(value);
        }
      }
    }
    this.value = value;
    this.dirty = true;
    // Sync before dispatching so `change` listeners reading FormData see the new value.
    this.internals.setFormValue(this.toFormValue(value));
    if (emitChange) {
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
  }

  protected markTouchedOnBlur = () => {
    this.touched = true;
  };

  protected toFormValue(value: V): FormData | string | null {
    if (value == null) {
      return null;
    }
    if (Array.isArray(value)) {
      const data = new FormData();
      value.forEach((item) => data.append(this.name, String(item)));
      return data;
    }
    return String(value);
  }

  protected willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    this.internals.setFormValue(this.toFormValue(this.value));
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    const message = this.errorMessage;
    if (message) {
      this.internals.setValidity({ customError: true }, message, this.validationTarget);
    } else {
      this.internals.setValidity({});
    }
    this.internals.ariaInvalid = this.showErrors ? "true" : null;
  }

  private onInvalid = (event: Event) => {
    // Our components render their own errors; suppress the browser's bubble.
    event.preventDefault();
    this.submitAttempted = true;
  };

  formResetCallback() {
    this.value = this.initialValue as V;
    this.touched = false;
    this.dirty = false;
    this.submitAttempted = false;
  }

  formDisabledCallback(disabled: boolean) {
    this.formDisabled = disabled;
  }

  formStateRestoreCallback(state: string | FormData | null) {
    if (typeof state === "string") {
      this.value = state as V;
    }
  }
}
