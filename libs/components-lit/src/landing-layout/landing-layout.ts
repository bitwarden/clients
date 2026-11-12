import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BackgroundLeftIllustration, BackgroundRightIllustration } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";

import { SlotByTagController } from "./slot-by-tag";
import { svgContent } from "./svg-content";

export type LandingLayoutClientType = "web" | "browser" | "desktop";

/**
 * Root layout for landing pages: a full-screen container with optional decorative background
 * illustrations in the bottom corners.
 *
 * A `bit-landing-header` child renders at the top and a `bit-landing-footer` child at the bottom;
 * everything else goes in `<main>`. No `slot` attributes are needed.
 *
 * @slot - Main content, typically `bit-landing-content`
 */
@customElement("bit-landing-layout")
export class BitLandingLayout extends BitElement {
  static shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @property({ type: Boolean, attribute: "hide-background-illustration" })
  hideBackgroundIllustration = false;

  /**
   * The client the page renders in. `web` fills the viewport height; `browser` and `desktop` fill
   * their container. Replaces Angular's `PlatformUtilsService.getClientType()`.
   */
  @property({ attribute: "client-type" }) clientType: LandingLayoutClientType = "web";

  constructor() {
    super();
    new SlotByTagController(this, { header: "bit-landing-header", footer: "bit-landing-footer" });
  }

  render() {
    return html`<div
      class="tw-relative tw-flex tw-size-full tw-mx-auto tw-flex-col ${
        this.clientType === "web" ? "tw-min-h-screen" : "tw-min-h-full"
      }"
    >
      <slot name="header"></slot>
      <main class="tw-relative tw-flex tw-flex-1 tw-size-full tw-mx-auto tw-flex-col">
        <slot></slot>
      </main>
      ${
        this.hideBackgroundIllustration
          ? nothing
          : html`<div
                class="tw-hidden md:tw-block [&_svg]:tw-absolute tw-z-[1] tw-opacity-[.11] [&_svg]:tw-bottom-0 [&_svg]:tw-start-0 [&_svg]:tw-w-[35%] [&_svg]:tw-max-w-[450px]"
                aria-hidden="true"
              >
                ${svgContent(BackgroundLeftIllustration)}
              </div>
              <div
                class="tw-hidden md:tw-block [&_svg]:tw-absolute tw-z-[1] tw-opacity-[.11] [&_svg]:tw-bottom-0 [&_svg]:tw-end-0 [&_svg]:tw-w-[35%] [&_svg]:tw-max-w-[450px]"
                aria-hidden="true"
              >
                ${svgContent(BackgroundRightIllustration)}
              </div>`
      }
      <slot name="footer"></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-landing-layout": BitLandingLayout;
  }
}
