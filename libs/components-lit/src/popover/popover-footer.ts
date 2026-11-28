import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * Actions area at the bottom of a `bit-popover`. Assigns itself to the popover's `footer` slot.
 *
 * @slot - Buttons or step indicators.
 */
@customElement("bit-popover-footer")
export class BitPopoverFooter extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    if (!this.slot) {
      this.slot = "footer";
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-popover-footer": BitPopoverFooter;
  }
}
