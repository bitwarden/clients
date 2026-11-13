import { css, html, nothing, PropertyValues, TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { BitFormControlElement } from "../core/form-control";
import { t } from "../core/i18n";
import { ValidationErrors, Validator, Validators } from "../core/validators";

import { renderError } from "./error";
import { FieldSize, fieldContainerClasses, hintClasses } from "./field-styles";
import { SlotController } from "./slot-controller";

export type FieldRenderOptions = {
  /** Skip the bordered container and render `control` directly below the label (dropzones). */
  custom?: boolean;
  /** Remove the content padding, for controls that pad themselves (selects). */
  flush?: boolean;
  /** Draw the native-select chevron inside the container. */
  selectArrow?: boolean;
  /** Layout tweaks for a multi-line control. */
  textarea?: boolean;
};

const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/**
 * Base for text-field-shaped controls (`bit-input`, `bit-textarea`, `bit-file-upload`, and
 * selects). Renders `bit-form-field`'s chrome around the control from `renderControl()`: label,
 * required marker, bordered container with `start`/`end` content, hint and error.
 *
 * To build a field:
 * - Extend `BitFieldElement<V>`, implement `value`, `validationTarget` and `renderControl()`.
 * - Give the focusable element `id=${this.controlId}` (the `<label for>` target) and
 *   `aria-describedby=${this.describedBy ?? nothing}`, `aria-invalid=${this.showErrors ? "true" : nothing}`.
 * - Call `this.setValue()` on user input and `this.markTouchedOnBlur` on blur.
 * - Optionally override `renderStart()`/`renderEnd()` to add built-in prefix/suffix content,
 *   `fieldOptions` for layout flags, and `constraintValidators()` for attribute-driven validation.
 *
 * @slot label - Label content, instead of the `label` property.
 * @slot label-end - Content after the label that should not truncate (info links, badges).
 * @slot hint - Hint content, instead of the `hint` property.
 * @slot start - Content before the control (Angular `bitPrefix`). Icon buttons become small.
 * @slot end - Content after the control (Angular `bitSuffix`). Icon buttons become small.
 * @slot inline-end - Content beside the field container, e.g. a button.
 * @csspart container - The bordered field container.
 */
export abstract class BitFieldElement<V = string> extends BitFormControlElement<V> {
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Visible label. Use the `label` slot for rich content. */
  @property() label = "";

  @property() hint = "";

  /** Keep the label for assistive technology only. */
  @property({ type: Boolean, attribute: "hide-label" }) hideLabel = false;

  @property({ reflect: true }) size: FieldSize = "base";

  @property({ type: Boolean, attribute: "readonly", reflect: true }) readOnly = false;

  /** Remove the bottom margin. */
  @property({ type: Boolean, attribute: "disable-margin" }) disableMargin = false;

  /** Keep showing errors while disabled (disabled controls normally hide their errors). */
  @property({ type: Boolean, attribute: "show-errors-when-disabled" })
  showErrorsWhenDisabled = false;

  @state() protected focusVisible = false;

  protected readonly slots = new SlotController(this);

  protected readonly controlId = "control";
  protected readonly hintId = "hint";
  protected readonly errorId = "error";

  private autofocused = false;

  protected abstract renderControl(): TemplateResult;

  protected get fieldOptions(): FieldRenderOptions {
    return {};
  }

  /** Built-in content rendered before the `start` slot. */
  protected renderStart(): TemplateResult | typeof nothing {
    return nothing;
  }

  /** Built-in content rendered before the `end` slot. */
  protected renderEnd(): TemplateResult | typeof nothing {
    return nothing;
  }

  /** Validators derived from attributes such as `minlength` or `type="email"`. */
  protected constraintValidators(): Validator<V>[] {
    return [];
  }

  get errors(): ValidationErrors | null {
    const validators = [
      ...(this.required ? [Validators.required as Validator<V>] : []),
      ...this.constraintValidators(),
      ...this.validators,
    ];
    const errors = validators.reduce<ValidationErrors>(
      (acc, validate) => ({ ...acc, ...validate(this.value) }),
      {},
    );
    return Object.keys(errors).length ? errors : null;
  }

  get showErrors() {
    if (this.isDisabled && !this.showErrorsWhenDisabled) {
      return false;
    }
    return super.showErrors;
  }

  protected get hasHint() {
    return !!this.hint || this.slots.has("hint");
  }

  /** `aria-describedby` for the control: the error while shown, otherwise the hint. */
  protected get describedBy(): string | undefined {
    if (this.showErrors) {
      return this.errorId;
    }
    return this.hasHint ? this.hintId : undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("focusin", this.onFocusIn);
    this.addEventListener("focusout", this.onFocusOut);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("focusin", this.onFocusIn);
    this.removeEventListener("focusout", this.onFocusOut);
  }

  protected firstUpdated(changed: PropertyValues) {
    super.firstUpdated(changed);
    if (this.autofocus && !this.autofocused && !isMobile()) {
      this.autofocused = true;
      // Wait a frame so the field is laid out (and visible) when focus moves.
      requestAnimationFrame(() => this.focus());
    }
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    for (const name of ["start", "end"]) {
      for (const el of this.slots.elements(name)) {
        if (el.localName === "bit-icon-button") {
          el.setAttribute("size", "small");
        }
      }
    }
  }

  /** Call from the control's `input` handler. Hides errors while typing, like `bitInput`. */
  protected onUserInput(value: V) {
    this.touched = false;
    this.value = value;
    this.dirty = true;
  }

  /** Applies normalizing validators (e.g. `trim`) and emits `change`. Call on native `change`. */
  protected commitValue() {
    this.setValue(this.value);
  }

  // The base emits `change` before the next render updates the form value; sync it first so
  // `change` listeners see current `FormData`.
  protected setValue(value: V, { emitChange = true } = {}) {
    super.setValue(value, { emitChange: false });
    this.internals.setFormValue(this.toFormValue(this.value));
    if (emitChange) {
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
  }

  protected renderLabel() {
    const required = this.required
      ? html`<sup
            class="tw-text-sm/5 tw-text-fg-danger tw-relative tw-top-[-1px]"
            aria-hidden="true"
            >*</sup
          ><span class="tw-sr-only"> (${t("required")})</span>`
      : nothing;
    return html`<label
      id="label"
      for=${this.controlId}
      class="tw-flex tw-items-center tw-gap-0.5 tw-text-sm/5 tw-font-medium tw-max-w-full ${
        this.hideLabel ? "tw-sr-only" : ""
      }"
    >
      <span class="tw-inline-flex tw-gap-1 tw-items-baseline tw-flex-row tw-min-w-0">
        <span class="tw-truncate" title=${this.label || nothing}
          ><slot name="label">${this.label}</slot></span
        >
        <slot name="label-end"></slot>
      </span>
      ${required}
    </label>`;
  }

  protected renderMessages() {
    const spacing = this.readOnly ? "" : "tw-mt-2";
    return html`
      ${renderError(this.errorId, this.showErrors ? this.errorMessage : null, spacing)}
      <div
        id=${this.hintId}
        class="${hintClasses} ${spacing}"
        ?hidden=${this.showErrors || !this.hasHint}
      >
        <slot name="hint">${this.hint}</slot>
      </div>
    `;
  }

  /** The complete field. Subclasses usually return `this.renderField(this.renderControl())`. */
  protected renderField(control: TemplateResult) {
    const options = this.fieldOptions;
    const disabled = this.isDisabled;
    const hasStart = this.renderStart() !== nothing || this.slots.has("start");
    const hasEnd = this.renderEnd() !== nothing || this.slots.has("end");
    const lastEnd = this.slots.elements("end").at(-1);
    const endIconButtonLast =
      lastEnd?.localName === "bit-icon-button" || (!lastEnd && this.renderEnd() !== nothing);

    const labelAndField = [
      "tw-flex",
      "tw-flex-col",
      ...(this.readOnly || this.hideLabel ? [] : ["tw-gap-2"]),
      ...(disabled ? ["!tw-text-fg-inactive"] : []),
    ].join(" ");

    const content = [
      "tw-size-full",
      "tw-min-w-0",
      "tw-relative",
      ...(options.flush ? ["tw-p-0"] : []),
      ...(options.textarea ? ["tw-pe-0", "!tw-py-3"] : []),
      ...(this.readOnly || options.flush ? [] : ["tw-px-3"]),
    ].join(" ");

    const inner = [
      "tw-flex",
      "tw-w-full",
      "tw-items-center",
      options.flush || options.selectArrow ? "tw-pe-0" : endIconButtonLast ? "tw-pe-1" : "tw-pe-3",
      ...(options.textarea ? ["!tw-items-start"] : []),
    ].join(" ");

    const start = [
      "tw-flex",
      "tw-items-center",
      "tw-border-e",
      "tw-border-border-base",
      "tw-px-3",
      "tw-bg-bg-quaternary",
      "tw-rounded-s-[11px]",
      "tw-transition-colors",
      "tw-text-fg-body",
      ...(disabled ? [] : ["group-hover/form-field:tw-text-fg-brand"]),
      ...(this.focusVisible ? ["!tw-text-fg-body-subtle"] : []),
    ].join(" ");

    const field = options.custom
      ? control
      : html`<div class="tw-flex tw-gap-2 tw-items-center">
          <div
            part="container"
            class=${fieldContainerClasses({
              size: this.size,
              hasError: this.showErrors,
              readOnly: this.readOnly,
              disabled,
              focusVisible: this.focusVisible,
              selectArrow: options.selectArrow,
            })}
          >
            <div class=${start} ?hidden=${!hasStart}>
              ${this.renderStart()}<slot name="start"></slot>
            </div>
            <div class=${inner}>
              <div class=${content}>${control}</div>
              <div
                class="tw-flex tw-items-center tw-text-fg-body ${options.textarea ? "tw-pt-1" : ""}"
                ?hidden=${!hasEnd}
              >
                ${this.renderEnd()}<slot name="end"></slot>
              </div>
            </div>
          </div>
          <slot name="inline-end"></slot>
        </div>`;

    return html`<div class=${this.disableMargin ? "" : "tw-mb-4 bit-compact:tw-mb-3"}>
      <div class=${labelAndField}>${this.renderLabel()} ${field}</div>
      ${this.renderMessages()}
    </div>`;
  }

  render() {
    return this.renderField(this.renderControl());
  }

  private onFocusIn = (event: FocusEvent) => {
    const target = event.composedPath()[0];
    this.focusVisible = target instanceof Element && target.matches(":focus-visible");
  };

  private onFocusOut = () => {
    this.focusVisible = false;
  };
}
