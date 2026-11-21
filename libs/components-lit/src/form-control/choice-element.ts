import { PropertyValues, TemplateResult } from "lit";
import { property, query } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { BitFormControlElement } from "../core/form-control";
import { ValidationErrors, Validator } from "../core/validators";
import { SlotController } from "../form-field/slot-controller";

import { choiceDescribedBy, choiceHostStyles, renderChoiceLayout } from "./choice-layout";

/** Implemented by controls a `bit-form-control-group` coordinates. */
export interface GroupedControl {
  /** @internal Set by an enclosing group. */
  groupDisabled: boolean;
  /** @internal Set by an enclosing group that collects values (the item doesn't submit itself). */
  grouped: boolean;
}

/**
 * Base for checkbox-like controls (`bit-checkbox`, `bit-switch`). Renders the inline row
 * (Angular `bit-form-control`) or, with `card`, the card layout (`bit-form-control-card`).
 *
 * Submits `value` under `name` while checked, like a native checkbox.
 *
 * @slot label - Label content, instead of the `label` property.
 * @slot label-end - Content after the label (info links, badges).
 * @slot hint - Hint content, instead of the `hint` property.
 * @slot start - Card only: leading content in place of `icon`.
 * @fires change - When the user toggles the control.
 */
export abstract class BitChoiceElement
  extends BitFormControlElement<string>
  implements GroupedControl
{
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [BitElement.styles, choiceHostStyles];

  @property({ type: Boolean, reflect: true }) checked = false;

  /** Submitted value while checked; also identifies the item inside a `bit-form-control-group`. */
  @property() value = "on";

  @property() label = "";

  @property() hint = "";

  /** Keep the label for assistive technology only, e.g. a row selection checkbox in a table. */
  @property({ type: Boolean, attribute: "hide-label" }) hideLabel = false;

  /** Lay out as a card (Angular `bit-form-control-card`). */
  @property({ type: Boolean, reflect: true }) card = false;

  /** Card only: icon tile shown before the label. */
  @property() icon?: string;

  /** Flow inline with siblings instead of stacking. */
  @property({ type: Boolean, reflect: true }) inline = false;

  @property({ type: Boolean, attribute: "disable-margin" }) disableMargin = false;

  /** @internal */
  @property({ attribute: false }) groupDisabled = false;

  /** @internal */
  @property({ attribute: false }) grouped = false;

  @query("input") protected input!: HTMLInputElement | null;

  protected readonly slots = new SlotController(this);

  private defaultChecked = false;

  protected abstract renderControl(): TemplateResult;

  protected get validationTarget() {
    return this.input ?? undefined;
  }

  get isDisabled() {
    return super.isDisabled || this.groupDisabled;
  }

  /** `required` means "must be checked" (Angular `Validators.requiredTrue`). */
  get errors(): ValidationErrors | null {
    const errors: ValidationErrors = this.required && !this.checked ? { required: true } : {};
    for (const validate of this.validators as Validator<unknown>[]) {
      Object.assign(errors, validate(this.checked));
    }
    return Object.keys(errors).length ? errors : null;
  }

  get showErrors() {
    return !this.isDisabled && super.showErrors;
  }

  connectedCallback() {
    super.connectedCallback();
    this.defaultChecked = this.checked;
    this.addEventListener("click", this.onHostClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this.onHostClick);
  }

  protected willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    this.internals.setFormValue(this.checked && !this.grouped ? this.value : null);
    if (this.checked) {
      this.internals.states?.add("checked");
    } else {
      this.internals.states?.delete("checked");
    }
  }

  formResetCallback() {
    super.formResetCallback();
    this.checked = this.defaultChecked;
  }

  formStateRestoreCallback(state: string | FormData | null) {
    this.checked = state != null;
  }

  /** Toggles as if clicked by the user. */
  click() {
    if (this.input) {
      this.input.click();
    } else {
      super.click();
    }
  }

  protected toggle(checked: boolean) {
    this.checked = checked;
    this.touched = true;
    this.dirty = true;
    this.internals.setFormValue(this.checked && !this.grouped ? this.value : null);
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  protected onInputChange = (event: Event) => {
    event.stopPropagation();
    this.toggle((event.target as HTMLInputElement).checked);
  };

  /** Activation of an external `<label>` lands on the host; forward it to the inner input. */
  private onHostClick = (event: MouseEvent) => {
    if (event.composedPath()[0] === this && !this.isDisabled) {
      this.input?.click();
    }
  };

  protected get hasHint() {
    return !!this.hint || this.slots.has("hint");
  }

  protected get describedBy() {
    return choiceDescribedBy({
      error: this.showErrors ? this.errorMessage : null,
      hasHint: this.hasHint,
    });
  }

  protected get labelText() {
    return this.label || this.querySelector("[slot=label]")?.textContent?.trim() || "";
  }

  render() {
    return renderChoiceLayout({
      control: this.renderControl(),
      label: this.label,
      hint: this.hint,
      hasHint: this.hasHint,
      hideLabel: this.hideLabel,
      required: this.required,
      disabled: this.isDisabled,
      error: this.showErrors ? this.errorMessage : null,
      card: this.card,
      icon: this.icon,
      hasStart: this.slots.has("start"),
      title: this.title ? "" : this.labelText,
      disableMargin: this.disableMargin || this.card,
    });
  }
}
