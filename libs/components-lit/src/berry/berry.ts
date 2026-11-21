import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

export type BerryVariant =
  "primary" | "subtle" | "success" | "warning" | "danger" | "accentPrimary" | "contrast";

const variantClass: Record<BerryVariant, string> = {
  primary: "tw-bg-bg-brand",
  subtle: "tw-bg-bg-contrast",
  success: "tw-bg-bg-success",
  warning: "tw-bg-bg-warning",
  danger: "tw-bg-bg-danger",
  accentPrimary: "tw-bg-fg-accent-primary-strong",
  contrast: "tw-bg-bg-primary",
};

/**
 * A compact indicator for short, supplemental status information about another element, like a
 * navigation item, button, or icon button.
 *
 * By default the full numeric value is shown. Use `maxDigits` to cap it: values at or above
 * `10^maxDigits` display as `(10^maxDigits - 1)+` (e.g. `max-digits="2"` shows `99+`). A count
 * berry with no positive value is hidden.
 */
@customElement("bit-berry")
export class BitBerry extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      :host(:state(empty)) {
        display: none;
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  @property({ reflect: true }) variant: BerryVariant = "primary";

  @property({ reflect: true }) type: "status" | "count" = "count";

  @property({ type: Number }) value?: number;

  /** Caps the digits shown in a count berry, e.g. `2` shows `99+` for values of 100 or more. */
  @property({ type: Number, attribute: "max-digits" }) maxDigits?: number;

  /** The text a count berry displays, or `undefined` when there is none. */
  get content(): string | undefined {
    const value = this.value;
    if (this.type === "status" || !value || value < 0) {
      return undefined;
    }
    // 10 ** maxDigits is 10 raised to the power of maxDigits, e.g. 10 ** 3 === 1000.
    if (this.maxDigits && value >= 10 ** this.maxDigits) {
      return `${(10 ** this.maxDigits - 1).toLocaleString()}+`;
    }
    return value.toLocaleString();
  }

  protected willUpdate() {
    if (!this.content && this.type === "count") {
      this.internals.states.add("empty");
    } else {
      this.internals.states.delete("empty");
    }
  }

  render() {
    const content = this.content;
    const typeClasses =
      this.type === "status"
        ? "tw-h-2 tw-w-2"
        : `tw-h-4 tw-min-w-4 ${(content?.length ?? 0) > 2 ? "tw-px-1.5 tw-py-0.5" : ""}`;
    return html`<span
      part="base"
      class="tw-inline-flex tw-items-center tw-justify-center tw-align-middle tw-text-xxs tw-rounded-full ${typeClasses} ${
        variantClass[this.variant] ?? variantClass.primary
      } ${this.variant === "contrast" ? "tw-text-fg-heading" : "tw-text-fg-contrast"}"
      >${content ?? nothing}</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-berry": BitBerry;
  }
}
