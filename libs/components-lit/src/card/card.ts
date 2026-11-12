import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { baseCardClasses } from "./base-card";

/**
 * A basic bordered container with assumed padding. Use for grouping related content into a single
 * block.
 *
 * Reach for `bit-card-segmented` instead when the content is multiple rows or sections separated by
 * full-width dividers.
 *
 * @slot - Card content
 * @csspart base - The card surface
 */
@customElement("bit-card")
export class BitCard extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  render() {
    return html`<div part="base" class="${baseCardClasses} tw-p-4 [@media(min-width:769px)]:tw-p-6">
      <slot></slot>
    </div>`;
  }
}

/**
 * Standard card padding, typically for segments of a `bit-card-segmented`.
 *
 * @slot - Content
 */
@customElement("bit-card-content")
export class BitCardContent extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  render() {
    return html`<div class="tw-p-4 [@media(min-width:769px)]:tw-p-6"><slot></slot></div>`;
  }
}

/**
 * A bordered, rounded card that draws a full-width horizontal divider between each of
 * its direct children. Makes no assumptions about segment content — project any
 * elements you like; each segment is responsible for its own padding and layout
 * (`<bit-card-content>` is a convenient choice for standard card padding).
 *
 * Dividers are drawn between *direct* children, so each segment must be a direct child of
 * `bit-card-segmented`; wrapping segments in an intermediate element removes the dividers.
 *
 * @slot - Segments
 * @csspart base - The card surface
 */
@customElement("bit-card-segmented")
export class BitCardSegmented extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      ::slotted(:not(:first-child)) {
        border-block-start: 1px solid var(--color-border-base);
      }
    `,
  ];

  render() {
    return html`<div part="base" class="${baseCardClasses} !tw-flex tw-flex-col">
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-card": BitCard;
    "bit-card-content": BitCardContent;
    "bit-card-segmented": BitCardSegmented;
  }
}
