import { html, nothing, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import { Validator, Validators } from "../core/validators";
import { BitFieldElement, FieldRenderOptions } from "../form-field/field-element";
import { fieldInputClasses } from "../form-field/field-styles";

/**
 * Multi-line text field (Angular `<textarea bitInput>` in a `bit-form-field`). Grows with its
 * content up to half the viewport height.
 *
 * Inherits the slots and parts of `BitFieldElement`.
 *
 * @fires input - On every keystroke.
 * @fires change - When the user commits a value (blur).
 */
@customElement("bit-textarea")
export class BitTextarea extends BitFieldElement<string> {
  @property() value = "";

  @property({ type: Number }) rows = 2;

  @property() placeholder?: string;

  @property() autocomplete?: string;

  @property({ type: Number }) minlength?: number;

  @property({ type: Number }) maxlength?: number;

  @property({ attribute: "spellcheck" }) protected forwardedSpellcheck?: string;

  @query("textarea") protected textarea!: HTMLTextAreaElement | null;

  protected get validationTarget() {
    return this.textarea ?? undefined;
  }

  protected get fieldOptions(): FieldRenderOptions {
    return { textarea: true };
  }

  protected constraintValidators(): Validator<string>[] {
    const validators: Validator[] = [];
    if (this.minlength != null) {
      validators.push(Validators.minLength(this.minlength));
    }
    if (this.maxlength != null) {
      validators.push(Validators.maxLength(this.maxlength));
    }
    return validators as Validator<string>[];
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (changed.has("value") || changed.has("rows")) {
      this.adjustHeight();
    }
  }

  private adjustHeight() {
    const textarea = this.textarea;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  protected renderControl() {
    return html`<textarea
      id=${this.controlId}
      class=${fieldInputClasses({ textarea: true, readOnly: this.readOnly })}
      rows=${this.rows}
      name=${this.name || nothing}
      .value=${live(this.value ?? "")}
      placeholder=${this.placeholder ?? nothing}
      autocomplete=${this.autocomplete ?? nothing}
      spellcheck=${this.forwardedSpellcheck ?? nothing}
      minlength=${this.minlength ?? nothing}
      maxlength=${this.maxlength ?? nothing}
      ?disabled=${this.isDisabled}
      ?readonly=${this.readOnly}
      ?required=${this.required}
      aria-describedby=${this.describedBy ?? nothing}
      aria-invalid=${this.showErrors ? "true" : nothing}
      @input=${this.onInput}
      @change=${() => this.commitValue()}
      @blur=${this.markTouchedOnBlur}
    ></textarea>`;
  }

  private onInput = (event: Event) => {
    this.onUserInput((event.target as HTMLTextAreaElement).value);
    this.adjustHeight();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-textarea": BitTextarea;
  }
}
