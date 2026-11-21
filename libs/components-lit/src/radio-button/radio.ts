import { html, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import { BitElement } from "../core/bit-element";
import { GroupedControl } from "../form-control/choice-element";
import {
  choiceDescribedBy,
  choiceHostStyles,
  ChoiceIds,
  renderChoiceLayout,
} from "../form-control/choice-layout";
import { SlotController } from "../form-field/slot-controller";

/**
 * The radio control's own rendering. Exported so a surface that can't host this component
 * still draws the same control from the same definition.
 */
export const radioInputClasses = [
  "tw-appearance-none",
  /**
   * tailwind's outline-none does not fully remove it because it supports forced colors mode, so
   * we need to do it manually
   */
  "focus-visible:[outline:none]",
  "tw-relative",
  "tw-transition",
  "tw-cursor-pointer",
  "tw-inline-block",
  "tw-w-6",
  "tw-h-6",
  "tw-m-0",
  "tw-rounded-full",
  "tw-flex-none",
  "hover:tw-bg-bg-hover",
  "focus-visible:tw-bg-bg-hover",
  "disabled:hover:tw-bg-transparent",

  "hover:before:tw-border-2",
  "focus-visible:before:tw-border-2",

  "tw-transition-colors",
  "before:tw-content-['']",
  "before:tw-block",
  "before:tw-inset-1",
  "before:tw-absolute",
  "before:tw-size-4",
  "before:tw-rounded-full",
  "before:tw-border",
  "before:tw-border-solid",
  "before:tw-border-border-strong",
  "before:tw-box-border",
  "before:tw-bg-bg-tertiary",

  "after:tw-content-['']",
  "after:tw-block",
  "after:tw-absolute",
  "after:tw-inset-2",
  "after:tw-size-2",
  "after:tw-box-border",
  "after:tw-rounded-full",

  "disabled:tw-cursor-auto",
  "disabled:tw-pointer-events-none",
  "disabled:tw-bg-transparent",
  "disabled:before:tw-bg-bg-inactive",
  "disabled:before:tw-border-border-base",

  "checked:hover:tw-bg-transparent",
  "checked:focus-visible:tw-bg-transparent",

  "checked:after:tw-bg-bg-brand",
  // forced-colors strips the background; use CanvasText so the svg stays visible
  "forced-colors:checked:after:tw-bg-[CanvasText]",

  "checked:before:tw-border-2",
  "checked:before:tw-border-border-brand",

  "checked:disabled:after:tw-bg-fg-inactive",
  "checked:disabled:hover:before:tw-border-border-base",
].join(" ");

/**
 * One option of a `bit-radio-group` (Angular `<input type="radio" bitRadio>` in a
 * `bit-form-control`, or `bit-radio-button`). Set `card` for the card layout.
 *
 * @slot label - Label content, instead of the `label` property.
 * @slot label-end - Content after the label (info links, badges).
 * @slot hint - Hint content, instead of the `hint` property.
 * @slot start - Card only: leading content in place of `icon`.
 */
@customElement("bit-radio")
export class BitRadio extends BitElement implements GroupedControl {
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [BitElement.styles, choiceHostStyles];

  @property() value = "";

  @property() label = "";

  @property() hint = "";

  @property({ type: Boolean, attribute: "hide-label" }) hideLabel = false;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Lay out as a card (Angular `bit-form-control-card`). */
  @property({ type: Boolean, reflect: true }) card = false;

  /** Card only: icon tile shown before the label. */
  @property() icon?: string;

  /** Set by the group. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** @internal Roving tabindex, set by the group. */
  @property({ attribute: false }) tabbable = false;

  /** @internal */
  @property({ attribute: false }) groupDisabled = false;

  /** @internal Radios never submit themselves; the group does. */
  grouped = true;

  @query("input") private input!: HTMLInputElement | null;

  private readonly slots = new SlotController(this);

  get isDisabled() {
    return this.disabled || this.groupDisabled;
  }

  render() {
    const hasHint = !!this.hint || this.slots.has("hint");
    const describedBy = choiceDescribedBy({ error: null, hasHint });
    return renderChoiceLayout({
      control: html`<input
        id=${ChoiceIds.control}
        type="radio"
        class=${radioInputClasses}
        tabindex=${this.tabbable ? 0 : -1}
        .checked=${live(this.checked)}
        ?disabled=${this.isDisabled}
        aria-labelledby=${ChoiceIds.label}
        aria-describedby=${describedBy ?? nothing}
        @change=${this.onChange}
      />`,
      label: this.label,
      hint: this.hint,
      hasHint,
      hideLabel: this.hideLabel,
      required: false,
      disabled: this.isDisabled,
      error: null,
      card: this.card,
      icon: this.icon,
      hasStart: this.slots.has("start"),
      title: this.title
        ? ""
        : this.label || this.querySelector("[slot=label]")?.textContent?.trim() || "",
      disableMargin: this.card,
    });
  }

  /** Activation of an external `<label>` lands on the host; forward it to the inner input. */
  click() {
    this.input?.click();
  }

  private onChange = (event: Event) => {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent("bit-radio-select", { bubbles: true, composed: true }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-radio": BitRadio;
  }
  interface HTMLElementEventMap {
    "bit-radio-select": CustomEvent<void>;
  }
}
