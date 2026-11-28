import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitSvg } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";
import { typography } from "../typography/typography";

import { LANDING_HERO_TEXT_ALIGNMENT_DEFAULT } from "./landing-defaults";
import { svgContent } from "./svg-content";

export type HeroTextAlignmentType = "left" | "center";

/**
 * Hero section for landing pages with an optional icon, title (the page `<h1>`) and subtitle. Use
 * as the first child of `bit-landing-content`.
 */
@customElement("bit-landing-hero")
export class BitLandingHero extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @property({ attribute: false }) icon: BitSvg | null = null;

  @property() title = "";

  @property() subtitle?: string;

  /**
   * Horizontal alignment of the title and subtitle. The icon is always centered.
   */
  @property({ attribute: "hero-text-alignment" })
  heroTextAlignment: HeroTextAlignmentType = LANDING_HERO_TEXT_ALIGNMENT_DEFAULT;

  render() {
    if (!this.icon && !this.title && !this.subtitle) {
      return nothing;
    }
    const alignment =
      this.heroTextAlignment === "left" ? "tw-text-left" : "tw-text-center tw-mx-auto";
    return html`<div class="tw-mb-4 sm:tw-mb-6 ${alignment}">
      ${
        this.icon
          ? // Target the SVG directly so it never grows too large, even if the media queries don't apply.
            html`<div
              class="tw-size-20 sm:tw-size-24 [&_svg]:tw-w-full [&_svg]:tw-max-w-24 tw-mx-auto tw-content-center"
              aria-hidden="true"
            >
              ${svgContent(this.icon)}
            </div>`
          : nothing
      }
      ${
        this.title
          ? html`<h1 class="${typography("h2")} tw-mt-2 sm:tw-hidden">${this.title}</h1>
              <h1 class="${typography("h1")} tw-mt-2 tw-hidden sm:tw-block">${this.title}</h1>`
          : nothing
      }
      ${
        this.subtitle
          ? html`<div class="tw-text-sm tw-mt-4 sm:tw-mt-0 sm:tw-text-base">${this.subtitle}</div>`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-landing-hero": BitLandingHero;
  }
}
