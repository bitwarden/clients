import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { BitSvg } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import type {
  ContentVerticalPaddingType,
  LandingContentMaxWidthType,
} from "../landing-layout/landing-content";
import type { FooterVerticalPaddingType } from "../landing-layout/landing-footer";
import type { HeroTextAlignmentType } from "../landing-layout/landing-hero";
import type { LandingLayoutClientType } from "../landing-layout/landing-layout";
import { typography } from "../typography/typography";

import { ANON_LAYOUT_DEFAULTS } from "./anon-layout-defaults";
import type { SecondaryContentLocationType } from "./anon-layout-wrapper-data";
import "../landing-layout/landing-card";
import "../landing-layout/landing-content";
import "../landing-layout/landing-footer";
import "../landing-layout/landing-header";
import "../landing-layout/landing-hero";
import "../landing-layout/landing-layout";

const SLOT_NAMES = ["header-actions", "secondary", "footer-secondary", "environment-selector"];

/**
 * Layout for unauthenticated pages (and a few exceptions such as Unlock and View Send). Apps
 * normally use `bit-anon-layout-wrapper`, which feeds it per-page data.
 *
 * @slot - Primary content, shown in a card unless `hideCardWrapper`.
 * @slot header-actions - Actions at the end of the header.
 * @slot secondary - Secondary content, beneath the card or in the footer (`secondaryContentLocation`).
 * @slot footer-secondary - Secondary content always rendered in the footer.
 * @slot environment-selector - Environment selector in the footer, unless `showReadonlyHostname`.
 */
@customElement("bit-anon-layout")
export class BitAnonLayout extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        /* Full height of the parent container for proper footer placement. */
        height: 100%;
      }
    `,
  ];

  /** Page title. Named `pageTitle` (not `title`) so it doesn't become the host's native tooltip. */
  @property({ attribute: "page-title" }) pageTitle?: string;

  @property({ attribute: "page-subtitle" }) pageSubtitle?: string;

  /** Page icon shown in the hero. */
  @property({ attribute: false }) icon: BitSvg | null = null;

  /** Show "Accessing {hostname}" instead of the environment selector. */
  @property({ type: Boolean, attribute: "show-readonly-hostname" })
  showReadonlyHostname = ANON_LAYOUT_DEFAULTS.showReadonlyHostname;

  /** The server hostname shown by `showReadonlyHostname`. Replaces `EnvironmentService`. */
  @property() hostname?: string;

  /** Application version shown in the web footer. Replaces `PlatformUtilsService`. */
  @property() version?: string;

  /**
   * The client the page renders in. The copyright year and version only show on `web`. Replaces
   * `PlatformUtilsService.getClientType()`.
   */
  @property({ attribute: "client-type" }) clientType: LandingLayoutClientType = "web";

  @property({ type: Boolean, attribute: "hide-logo" }) hideLogo = false;

  @property({ type: Boolean, attribute: "hide-footer" }) hideFooter = false;

  @property({ type: Boolean, attribute: "hide-card-wrapper" })
  hideCardWrapper = ANON_LAYOUT_DEFAULTS.hideCardWrapper;

  @property({ type: Boolean, attribute: "hide-background-illustration" })
  hideBackgroundIllustration = ANON_LAYOUT_DEFAULTS.hideBackgroundIllustration;

  @property({ type: Boolean, attribute: "hide-page-icon" })
  hidePageIcon = ANON_LAYOUT_DEFAULTS.hidePageIcon;

  @property({ attribute: "content-vertical-padding" })
  contentVerticalPadding: ContentVerticalPaddingType = ANON_LAYOUT_DEFAULTS.contentVerticalPadding;

  @property({ attribute: "footer-vertical-padding" })
  footerVerticalPadding: FooterVerticalPaddingType = ANON_LAYOUT_DEFAULTS.footerVerticalPadding;

  @property({ attribute: "hero-text-alignment" })
  heroTextAlignment: HeroTextAlignmentType = ANON_LAYOUT_DEFAULTS.heroTextAlignment;

  @property({ attribute: "secondary-content-location" })
  secondaryContentLocation: SecondaryContentLocationType =
    ANON_LAYOUT_DEFAULTS.secondaryContentLocation;

  /** Max width of the title, subtitle, and content areas. */
  @property({ attribute: "max-width" }) maxWidth: LandingContentMaxWidthType =
    ANON_LAYOUT_DEFAULTS.maxWidth;

  /** Where the header logo links to. */
  @property({ attribute: "logo-href" }) logoHref = "/";

  @state() private filled = new Set<string>();

  private readonly year = new Date().getFullYear().toString();
  private readonly observer = new MutationObserver(() => this.detectSlots());

  connectedCallback() {
    super.connectedCallback();
    this.detectSlots();
    this.observer.observe(this, { childList: true, subtree: true, attributeFilter: ["slot"] });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  // Named slots are only rendered when filled, so empty ones don't add spacing to the landing
  // primitives (which, like Angular's `:has(*)`, react to any slotted element).
  private detectSlots() {
    const filled = new Set(
      SLOT_NAMES.filter((name) => this.querySelector(`:scope > [slot="${name}"]`)),
    );
    if ([...filled].join() !== [...this.filled].join()) {
      this.filled = filled;
    }
  }

  private namedSlot(name: string) {
    return this.filled.has(name) ? html`<slot name=${name}></slot>` : nothing;
  }

  render() {
    const secondaryInFooter = this.secondaryContentLocation === "footer";
    return html`<bit-landing-layout
      ?hide-background-illustration=${this.hideBackgroundIllustration}
      client-type=${this.clientType}
    >
      <bit-landing-header ?hide-logo=${this.hideLogo} logo-href=${this.logoHref}>
        ${this.namedSlot("header-actions")}
      </bit-landing-header>

      <bit-landing-content
        max-width=${this.maxWidth ?? ANON_LAYOUT_DEFAULTS.maxWidth}
        content-vertical-padding=${this.contentVerticalPadding}
      >
        <bit-landing-hero
          .icon=${this.hidePageIcon ? null : this.icon}
          .title=${this.pageTitle ?? ""}
          .subtitle=${this.pageSubtitle}
          hero-text-alignment=${this.heroTextAlignment}
        ></bit-landing-hero>
        ${
          this.hideCardWrapper
            ? html`<div class="tw-mb-6 sm:tw-mb-10"><slot></slot></div>`
            : html`<bit-landing-card><slot></slot></bit-landing-card>`
        }
        <div class="tw-flex tw-flex-col tw-items-center">
          ${secondaryInFooter ? nothing : this.namedSlot("secondary")}
        </div>
      </bit-landing-content>

      ${
        this.hideFooter
          ? nothing
          : html`<bit-landing-footer footer-vertical-padding=${this.footerVerticalPadding}>
              <div class=${secondaryInFooter ? "tw-grid tw-gap-6" : ""}>
                ${secondaryInFooter ? this.namedSlot("secondary") : nothing}
                ${this.namedSlot("footer-secondary")}
                ${
                  this.showReadonlyHostname
                    ? html`<div class=${typography("body2")}>
                        ${t("accessing")} ${this.hostname}
                      </div>`
                    : this.namedSlot("environment-selector")
                }
              </div>
              ${
                this.clientType === "web"
                  ? html`<div class=${typography("body2")}>&copy; ${this.year} Bitwarden Inc.</div>
                      <div class=${typography("body2")}>${this.version}</div>`
                  : nothing
              }
            </bit-landing-footer>`
      }
    </bit-landing-layout>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-anon-layout": BitAnonLayout;
  }
}
