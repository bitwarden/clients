import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * Arranges skeleton loaders into a pre-arranged group that mimics the table and item components.
 *
 * Pass skeleton loaders into the start, default, and end content slots. The content within each slot
 * is fully customizable.
 *
 * @slot start - Before the default content; doesn't grow
 * @slot - Main content; grows to fill the horizontal space
 * @slot end - After the default content; doesn't grow
 */
@customElement("bit-skeleton-group")
export class BitSkeletonGroup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  render() {
    return html`<div class="tw-flex tw-flex-row tw-justify-between tw-gap-2">
      <div class="tw-flex tw-gap-2 tw-w-full">
        <slot name="start"></slot>
        <slot></slot>
      </div>
      <slot name="end"></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-skeleton-group": BitSkeletonGroup;
  }
}
