import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitSvg, BitwardenShield, SideNavLogo, SideNavLogoBeta } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";

import { SideNavStateController } from "./side-nav-state";
import "../svg/svg";

/**
 * The product logo at the top of a `bit-side-nav`, linking to the product's home page. Placed
 * into the side nav's logo position automatically.
 */
@customElement("bit-nav-logo")
export class BitNavLogo extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  /** Icon displayed when the side nav is closed. Defaults to `BitwardenShield`. */
  @property({ attribute: false }) closedIcon: BitSvg = BitwardenShield;

  /** Icon displayed when the side nav is open. The VFO1 side nav always shows its own logo. */
  @property({ attribute: false }) openIcon?: BitSvg;

  /** Link target. Replaces Angular's `route`. */
  @property() href = "";

  /** Passed to `aria-label` and `title`. */
  @property() label = "";

  /** Whether `href` is the current page (`aria-current="page"`). */
  @property({ type: Boolean, reflect: true }) active = false;

  /**
   * Shows the beta logo in the VFO1 side nav. Replaces Angular's build-time `prereleaseBuild` flag.
   */
  @property({ type: Boolean }) beta = false;

  private readonly nav = new SideNavStateController(this);

  render() {
    const { open, version, isOverlay } = this.nav.state;
    const current = this.active ? "page" : nothing;

    if (version === "vfo1") {
      return html`<a
        href=${this.href}
        class="tw-relative tw-grow tw-flex tw-p-3 tw-rounded-xl tw-outline-none focus-visible:tw-ring focus-visible:tw-ring-inset focus-visible:tw-ring-border-nav-focus focus-visible:tw-bg-bg-nav-hover hover:tw-bg-bg-nav-hover [&_bit-svg]:tw-w-[153px] ${
          open ? "" : "[&_bit-svg]:!tw-w-[20px]"
        }"
        aria-label=${this.label}
        title=${this.label}
        aria-current=${current}
      >
        <bit-svg
          .content=${open ? (this.beta ? SideNavLogoBeta : SideNavLogo) : this.closedIcon}
        ></bit-svg>
      </a>`;
    }

    return html`<div
      class="tw-px-2 tw-bg-bg-nav ${
        open ? "tw-sticky tw-top-0 tw-z-50 tw-pb-4" : "tw-pb-[calc(theme(spacing.8)_+_2px)]"
      } ${
        isOverlay ? "tw-pt-[calc(0.5rem_+_var(--bit-sidenav-extra-top-padding,_0px))]" : "tw-pt-2"
      }"
    >
      <!-- absolutely position the svg to avoid shifting layout when sidenav is closed -->
      <a
        href=${this.href}
        class="tw-relative tw-p-3 tw-block tw-rounded-md tw-outline-none focus-visible:tw-ring focus-visible:tw-ring-inset focus-visible:tw-ring-border-nav-focus hover:tw-bg-bg-nav-hover tw-h-[73px] [&_bit-svg]:tw-absolute [&_bit-svg]:tw-inset-[.6875rem] [&_bit-svg]:tw-w-[200px] ${
          open ? "" : "!tw-h-[55px] [&_bit-svg]:!tw-w-[26px]"
        }"
        aria-label=${this.label}
        title=${this.label}
        aria-current=${current}
      >
        <bit-svg .content=${open ? this.openIcon : this.closedIcon}></bit-svg>
      </a>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-nav-logo": BitNavLogo;
  }
}
