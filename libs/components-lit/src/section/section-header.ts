import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

const PADDED_SIBLINGS = "bit-card, bit-card-segmented, bit-item";

/**
 * Heading row for a `bit-section`. Gains bottom and inline padding when a `bit-card`,
 * `bit-card-segmented` or `bit-item` is the next sibling or nested in it, so the header aligns with
 * the card's border radius.
 *
 * @slot - Title, typically an `h2` styled as h6, plus optional suffixes such as an icon button
 * @slot end - Content placed at the end of the header
 */
@customElement("bit-section-header")
export class BitSectionHeader extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      :host([padded]) {
        padding-block-end: 0.25rem;
        padding-inline: 0.25rem;
      }
      .title ::slotted(*) {
        margin-bottom: 0 !important;
        color: rgb(var(--color-text-main));
      }
    `,
  ];

  private observer?: MutationObserver;

  connectedCallback() {
    super.connectedCallback();
    this.updatePadding();
    if (this.parentNode) {
      // Siblings can't be matched from inside the shadow root, so watch the parent instead.
      this.observer = new MutationObserver(() => this.updatePadding());
      this.observer.observe(this.parentNode, { childList: true, subtree: true });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private updatePadding() {
    const next = this.nextElementSibling;
    this.toggleAttribute(
      "padded",
      !!next && (next.matches(PADDED_SIBLINGS) || !!next.querySelector(PADDED_SIBLINGS)),
    );
  }

  render() {
    return html`<div class="tw-flex tw-justify-between tw-items-end tw-gap-1">
      <div class="title tw-flex tw-items-center tw-gap-1"><slot></slot></div>
      <div class="tw-text-muted -tw-mb-0.5"><slot name="end"></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-section-header": BitSectionHeader;
  }
}
