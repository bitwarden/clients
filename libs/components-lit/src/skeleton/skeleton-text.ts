import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import "./skeleton";

/**
 * Specific skeleton component used to represent lines of text. It uses the `bit-skeleton`
 * under the hood.
 *
 * Customize the number of lines represented with `lines`. Customize the width by applying a class
 * to the `bit-skeleton-text` element (i.e. `tw-w-1/2`).
 */
@customElement("bit-skeleton-text")
export class BitSkeletonText extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** The number of text lines to display. */
  @property({ type: Number }) lines = 1;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
  }

  render() {
    const count = Math.max(0, Math.floor(this.lines));
    return html`<div class="tw-w-full tw-flex tw-flex-col tw-gap-2">
      ${Array.from(
        { length: count },
        (_, i) =>
          html`<bit-skeleton
            class="tw-h-3 ${i > 0 && i === count - 1 ? "tw-w-1/3" : "tw-w-full"}"
          ></bit-skeleton>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-skeleton-text": BitSkeletonText;
  }
}
