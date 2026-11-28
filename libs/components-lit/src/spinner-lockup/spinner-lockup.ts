import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import type { SpinnerSize, SpinnerVariant } from "../spinner/spinner";
import "../spinner/spinner";

export type SpinnerLockupOrientation = "horizontal" | "vertical";

const textStyles: Record<SpinnerSize, string> = {
  sm: "tw-text-xs tw-leading-4",
  md: "tw-text-sm tw-leading-5",
  base: "tw-text-base tw-leading-6",
  lg: "tw-text-xl tw-leading-7",
};

const orientationStyles: Record<
  SpinnerLockupOrientation,
  { container: string; textContainer: string }
> = {
  horizontal: { container: "tw-flex-row tw-gap-3", textContainer: "" },
  vertical: { container: "tw-flex-col tw-gap-2", textContainer: "tw-items-center" },
};

/**
 * Combines a spinner with a title and body text lockup.
 * Supports horizontal and vertical orientations, all spinner size variants, and all color variants.
 *
 * @slot title - Heading text
 * @slot description - Body text
 */
@customElement("bit-spinner-lockup")
export class BitSpinnerLockup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Size of the spinner and corresponding text scale. */
  @property({ reflect: true }) size: SpinnerSize = "base";

  /** Color variant of the spinner. */
  @property({ reflect: true }) variant: SpinnerVariant = "primary";

  /** Orientation of the spinner relative to the text. */
  @property({ reflect: true }) orientation: SpinnerLockupOrientation = "horizontal";

  render() {
    const orientation = orientationStyles[this.orientation];
    const text = textStyles[this.size];
    return html`<div class="tw-flex tw-items-center ${orientation.container}">
      <bit-spinner size=${this.size} variant=${this.variant}></bit-spinner>
      <div class="tw-flex tw-flex-col ${orientation.textContainer}">
        <span class="${text} tw-font-medium tw-text-fg-heading"><slot name="title"></slot></span>
        <span class="${text} tw-font-normal tw-text-fg-body"><slot name="description"></slot></span>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-spinner-lockup": BitSpinnerLockup;
  }
}
