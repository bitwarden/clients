import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * A vertical rule for separating groups of filter chips.
 *
 * ```html
 * <bit-filter-menu key="type" placeholder-text="Type">…</bit-filter-menu>
 * <bit-filter-divider></bit-filter-divider>
 * <bit-filter-toggle key="favorite" label="Favorites"></bit-filter-toggle>
 * ```
 */
@customElement("bit-filter-divider")
export class BitFilterDivider extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-block;
        vertical-align: middle;
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  constructor() {
    super();
    this.internals.role = "separator";
    this.internals.ariaOrientation = "vertical";
  }

  render() {
    return html`<div class="tw-mx-2 tw-h-6 tw-w-px tw-bg-border-base"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-filter-divider": BitFilterDivider;
  }
}
