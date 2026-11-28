import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitwardenLogo, BitwardenLogoBeta } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

import { svgContent } from "./svg-content";

/**
 * Header for landing pages with an optional Bitwarden logo linking home, and right-aligned header
 * actions.
 *
 * @slot - Header actions, aligned to the end
 */
@customElement("bit-landing-header")
export class BitLandingHeader extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @property({ type: Boolean, attribute: "hide-logo" }) hideLogo = false;

  /** Where the logo links to. Replaces Angular's `routerLink="/"`. */
  @property({ attribute: "logo-href" }) logoHref = "/";

  /** Shows the beta logo. Replaces Angular's `prereleaseBuild` build flag. */
  @property({ type: Boolean }) prerelease = false;

  @state() private hasActions = false;

  private onSlotChange(event: Event) {
    this.hasActions = (event.target as HTMLSlotElement).assignedElements().length > 0;
  }

  render() {
    return html`<header class="tw-flex tw-w-full tw-bg-background-alt tw-px-5">
      ${
        this.hideLogo
          ? nothing
          : html`<a
              href=${this.logoHref}
              aria-label=${t("appLogoLabel")}
              class="tw-w-32 tw-py-5 sm:tw-w-[200px] tw-self-center sm:tw-self-start tw-block [&>*]:tw-align-top [&_svg]:tw-w-full [&_svg]:tw-h-auto"
            >
              ${svgContent(this.prerelease ? BitwardenLogoBeta : BitwardenLogo)}
            </a>`
      }
      <div class=${this.hasActions ? "tw-ms-auto tw-py-5" : ""}>
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
    </header>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-landing-header": BitLandingHeader;
  }
}
