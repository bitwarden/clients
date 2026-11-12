import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * Standard card border, background and radius. Apply to an element inside a shadow root to get the
 * same look as `bit-base-card` (replaces Angular's `BaseCardDirective`).
 */
export const baseCardClasses =
  "tw-box-border tw-block tw-bg-bg-primary tw-text-fg-heading tw-border tw-border-solid tw-border-border-base tw-rounded-xl";

/**
 * The base card component is a container that applies our standard card border and box-shadow.
 * In most cases using our `<bit-card>` component should suffice.
 *
 * @slot - Card content
 * @csspart base - The card surface
 */
@customElement("bit-base-card")
export class BitBaseCard extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  render() {
    return html`<div part="base" class=${baseCardClasses}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-base-card": BitBaseCard;
  }
}
