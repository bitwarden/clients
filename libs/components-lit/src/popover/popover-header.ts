import { html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * Media area at the top of a `bit-popover`. Assigns itself to the popover's `header` slot.
 *
 * @slot media - Image or illustration.
 * @slot - Same as `media`.
 */
@customElement("bit-popover-header")
export class BitPopoverHeader extends BitElement {
  connectedCallback() {
    super.connectedCallback();
    if (!this.slot) {
      this.slot = "header";
    }
  }

  render() {
    return html`<div class="tw-p-2 tw-pb-0">
      <div class="tw-overflow-hidden tw-rounded-lg"><slot name="media"></slot><slot></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-popover-header": BitPopoverHeader;
  }
}
