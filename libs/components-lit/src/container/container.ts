import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * bit-container is a minimally styled component that limits the max width of its content to the tailwind theme variable '4xl'. '4xl' is equal to the value of 56rem
 *
 * @slot - Content
 */
@customElement("bit-container")
export class BitContainer extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  render() {
    return html`<div class="tw-max-w-4xl"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-container": BitContainer;
  }
}
