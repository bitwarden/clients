import { html, nothing, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import { setAriaAttributes } from "../core/aria";
import { t } from "../core/i18n";
import { Validator, Validators } from "../core/validators";
import { BitFieldElement } from "../form-field/field-element";
import { fieldInputClasses } from "../form-field/field-styles";
import "../icon-button/icon-button";

export type InputType =
  | "text"
  | "password"
  | "email"
  | "number"
  | "search"
  | "url"
  | "tel"
  | "date"
  | "time"
  | "datetime-local"
  | "month"
  | "week";

/**
 * Text field (Angular `<bit-form-field>` + `<input bitInput>`). Renders its own label, hint and
 * error, and forwards autofill-relevant attributes (`name`, `autocomplete`, `inputmode`, ...) to
 * the inner `<input>`.
 *
 * Constraint attributes (`minlength`, `maxlength`, `min`, `max`, `pattern`, `type="email"`) are
 * validated with the same messages as the Angular validators.
 *
 * Inherits the slots and parts of `BitFieldElement`.
 *
 * @fires input - On every keystroke.
 * @fires change - When the user commits a value (blur or Enter).
 * @fires toggledChange - When the password visibility toggle changes. `detail` is `toggled`.
 */
@customElement("bit-input")
export class BitInput extends BitFieldElement<string> {
  @property() value = "";

  @property({ reflect: true }) type: InputType = "text";

  @property() placeholder?: string;

  /** Forwarded to the inner input; important for password manager autofill. */
  @property() autocomplete?: AutoFill | string;

  @property({ type: Number }) minlength?: number;

  @property({ type: Number }) maxlength?: number;

  @property() min?: string;

  @property() max?: string;

  @property() step?: string;

  /** Regular expression the whole value must match. */
  @property() pattern?: string;

  /** Adds a show/hide button for `type="password"` (Angular `bitPasswordInputToggle`). */
  @property({ type: Boolean, attribute: "password-toggle" }) passwordToggle = false;

  /** Whether the password is shown. Two-way bindable via `toggledChange`. */
  @property({ type: Boolean, reflect: true }) toggled = false;

  // Global attributes that HTMLElement already defines as properties; observed under other names
  // so the native setters (which reflect to the attribute) keep working.
  @property({ attribute: "inputmode" }) protected forwardedInputMode?: string;
  @property({ attribute: "enterkeyhint" }) protected forwardedEnterKeyHint?: string;
  @property({ attribute: "autocapitalize" }) protected forwardedAutocapitalize?: string;
  @property({ attribute: "spellcheck" }) protected forwardedSpellcheck?: string;

  @query("input") protected input!: HTMLInputElement | null;

  @query("bit-icon-button") private toggleButton!: HTMLElement | null;

  protected get validationTarget() {
    return this.input ?? undefined;
  }

  /** Selects the text, like `HTMLInputElement.select()`. */
  select() {
    this.input?.select();
  }

  protected constraintValidators(): Validator<string>[] {
    const validators: Validator[] = [];
    if (this.type === "email") {
      validators.push(Validators.email);
    }
    if (this.minlength != null) {
      validators.push(Validators.minLength(this.minlength));
    }
    if (this.maxlength != null) {
      validators.push(Validators.maxLength(this.maxlength));
    }
    if (this.type === "number" && this.min != null && this.min !== "") {
      validators.push(Validators.min(Number(this.min)));
    }
    if (this.type === "number" && this.max != null && this.max !== "") {
      validators.push(Validators.max(Number(this.max)));
    }
    if (this.pattern) {
      validators.push(Validators.pattern(new RegExp(`^(?:${this.pattern})$`, "u")));
    }
    return validators as Validator<string>[];
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (this.toggleButton) {
      void setAriaAttributes(this.toggleButton, { "aria-pressed": String(this.toggled) });
    }
  }

  private get showToggle() {
    return this.passwordToggle && this.type === "password";
  }

  protected renderEnd() {
    if (!this.showToggle) {
      return nothing;
    }
    return html`<bit-icon-button
      size="small"
      icon=${this.toggled ? "bwi-eye-slash" : "bwi-eye"}
      label=${t("toggleVisibility")}
      @click=${this.onToggle}
    ></bit-icon-button>`;
  }

  protected renderControl() {
    const revealed = this.showToggle && this.toggled;
    return html`<input
      id=${this.controlId}
      class=${fieldInputClasses()}
      type=${revealed ? "text" : this.type}
      name=${this.name || nothing}
      .value=${live(this.value ?? "")}
      placeholder=${this.placeholder ?? nothing}
      autocomplete=${this.autocomplete ?? nothing}
      inputmode=${this.forwardedInputMode ?? nothing}
      enterkeyhint=${this.forwardedEnterKeyHint ?? nothing}
      autocapitalize=${this.forwardedAutocapitalize ?? nothing}
      spellcheck=${revealed ? "false" : (this.forwardedSpellcheck ?? nothing)}
      minlength=${this.minlength ?? nothing}
      maxlength=${this.maxlength ?? nothing}
      min=${this.min ?? nothing}
      max=${this.max ?? nothing}
      step=${this.step ?? nothing}
      ?disabled=${this.isDisabled}
      ?readonly=${this.readOnly}
      ?required=${this.required}
      aria-describedby=${this.describedBy ?? nothing}
      aria-invalid=${this.showErrors ? "true" : nothing}
      @input=${this.onInput}
      @change=${this.onChange}
      @blur=${this.markTouchedOnBlur}
    />`;
  }

  private onInput = (event: Event) => {
    this.onUserInput((event.target as HTMLInputElement).value);
  };

  private onChange = () => {
    this.commitValue();
  };

  private onToggle = () => {
    this.toggled = !this.toggled;
    this.dispatchEvent(
      new CustomEvent("toggledChange", { detail: this.toggled, bubbles: true, composed: true }),
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-input": BitInput;
  }
}
