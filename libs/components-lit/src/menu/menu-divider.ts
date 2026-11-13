import { html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/** Separates groups of items in a `bit-menu`. */
@customElement("bit-menu-divider")
export class BitMenuDivider extends BitElement {
  render() {
    return html`<div class="tw-h-px -tw-mx-2 tw-my-2 tw-bg-border-base" role="separator"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-menu-divider": BitMenuDivider;
  }
}
