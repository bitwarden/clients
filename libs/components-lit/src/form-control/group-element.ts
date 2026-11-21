import { css, html, nothing, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { BitFormControlElement } from "../core/form-control";
import { t } from "../core/i18n";
import { renderError } from "../form-field/error";
import { hintClasses } from "../form-field/field-styles";
import { SlotController } from "../form-field/slot-controller";

import { GroupedControl } from "./choice-element";

/**
 * Base for `bit-form-control-group` and `bit-radio-group`: a fieldset with legend, hint and
 * error around checkboxes, switches, radios or their cards.
 *
 * @slot - The controls.
 * @slot label - Legend content, instead of the `label` property.
 * @slot hint - Hint content, instead of the `hint` property.
 */
export abstract class BitGroupElement<V> extends BitFormControlElement<V> {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        margin-bottom: 1rem;
      }
    `,
  ];

  /** Legend. Use the `label` slot for rich content. */
  @property() label = "";

  @property() hint = "";

  /** Stack the controls vertically. */
  @property({ type: Boolean, reflect: true }) block = false;

  /**
   * Lay children out in a responsive grid. Intended for radio and checkbox cards; switch cards are
   * not supported in grid layout.
   */
  @property({ type: Boolean, reflect: true }) grid = false;

  protected readonly slots = new SlotController(this);

  /** The coordinated child controls. */
  protected abstract get items(): (HTMLElement & GroupedControl)[];

  /** Whether the controls stack vertically. */
  protected get stacked() {
    return this.block;
  }

  protected abstract readonly groupRole: "group" | "radiogroup";

  protected get validationTarget() {
    return this.items.find((item) => !(item as { disabled?: boolean }).disabled) ?? this.items[0];
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("focusout", this.onFocusOut);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("focusout", this.onFocusOut);
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    this.syncItems();
  }

  /** Pushes group state (disabled, selection) to the children. */
  protected syncItems() {
    for (const item of this.items) {
      item.groupDisabled = this.isDisabled;
    }
  }

  private onFocusOut = (event: FocusEvent) => {
    if (!this.contains(event.relatedTarget as Node)) {
      this.touched = true;
    }
  };

  private onSlotChange = () => this.syncItems();

  private get containerClasses() {
    if (this.grid) {
      // min(100%, …) collapses to a single column when the container is narrower than the track.
      return "tw-grid tw-grid-cols-[repeat(auto-fit,minmax(min(100%,225px),1fr))] tw-gap-2";
    }
    return this.stacked
      ? "tw-flex tw-flex-col tw-gap-2"
      : "tw-flex tw-flex-wrap tw-gap-x-4 tw-gap-y-2";
  }

  render() {
    const hasLabel = !!this.label || this.slots.has("label");
    const hasHint = !!this.hint || this.slots.has("hint");
    const error = this.showErrors ? this.errorMessage : null;
    const describedBy = error ? "error" : hasHint ? "hint" : undefined;

    return html`<fieldset
      class="tw-border-none tw-m-0 tw-p-0 tw-min-w-0"
      role=${this.groupRole}
      aria-labelledby=${hasLabel ? "legend" : nothing}
      aria-describedby=${describedBy ?? nothing}
      aria-required=${this.required && this.groupRole === "radiogroup" ? "true" : nothing}
      aria-invalid=${error ? "true" : nothing}
    >
      <legend
        id="legend"
        class="tw-flex tw-gap-0.5 tw-items-center tw-mb-2 tw-p-0 tw-text-sm/5 tw-font-medium"
        ?hidden=${!hasLabel}
      >
        <slot name="label">${this.label}</slot>
        ${
          this.required
            ? html`<sup
                  class="tw-text-sm tw-text-fg-danger tw-relative tw-top-[-1px]"
                  aria-hidden="true"
                  >*</sup
                ><span class="tw-sr-only"> (${t("required")})</span>`
            : nothing
        }
      </legend>
      <div class=${this.containerClasses} style="--bit-choice-margin: 0">
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      ${renderError("error", error, "tw-mt-2 tw-ms-0.5 !tw-text-fg-danger")}
      <div id="hint" class="${hintClasses} tw-mt-2" ?hidden=${!!error || !hasHint}>
        <slot name="hint">${this.hint}</slot>
      </div>
    </fieldset>`;
  }
}
