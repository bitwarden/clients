import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { LANDING_FOOTER_VERTICAL_PADDING_DEFAULT } from "./landing-defaults";

export type FooterVerticalPaddingType = "compact" | "default";

/**
 * Footer for landing pages (links, copyright, legal). Place inside `bit-landing-layout`; it always
 * renders at the bottom.
 *
 * @slot - Footer content
 */
@customElement("bit-landing-footer")
export class BitLandingFooter extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Vertical padding of the footer. "compact" reduces it. */
  @property({ attribute: "footer-vertical-padding" })
  footerVerticalPadding: FooterVerticalPaddingType = LANDING_FOOTER_VERTICAL_PADDING_DEFAULT;

  render() {
    return html`<footer
      class="tw-bg-background-alt tw-text-center tw-px-5 ${
        this.footerVerticalPadding === "compact" ? "tw-py-3" : "tw-pb-5 tw-pt-4 sm:tw-pt-6"
      }"
    >
      <slot></slot>
    </footer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-landing-footer": BitLandingFooter;
  }
}
