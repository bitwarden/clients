import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * Card for landing pages: an elevated container on larger screens, unboxed on small ones. Use
 * inside `bit-landing-content` to wrap forms or content sections.
 *
 * @slot - Card content
 * @csspart base - The card surface
 */
@customElement("bit-landing-card")
export class BitLandingCard extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  render() {
    // Same look as `bit-base-card` with the landing overrides; written out so no utility conflicts.
    return html`<div
      part="base"
      class="tw-box-border tw-block tw-text-fg-heading tw-z-[2] tw-relative tw-rounded-2xl tw-mb-6 sm:tw-mb-10 tw-mx-auto tw-w-full tw-bg-transparent tw-border-none tw-shadow-none sm:tw-bg-background sm:tw-border sm:tw-border-solid sm:tw-border-secondary-100 sm:tw-shadow sm:tw-p-8"
    >
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-landing-card": BitLandingCard;
  }
}
