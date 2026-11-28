import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import "../icon-button/icon-button";
import "../icon-tile/icon-tile";
import { BitwardenIcon } from "../icon/shared-icon";
import type { DecorativeVariant } from "../icon-tile/decorative-colors";
import { SideNavStateController } from "../navigation/side-nav-state";

export type BannerVariant = "primary" | "success" | "warning" | "danger";

const defaultIcon: Record<BannerVariant, BitwardenIcon> = {
  primary: "bwi-info-circle",
  success: "bwi-star",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
};

const bannerColors: Record<BannerVariant, string> = {
  primary: "tw-bg-bg-brand-softer tw-border-b-border-brand-soft",
  success: "tw-bg-bg-success-soft tw-border-b-border-success-soft",
  warning: "tw-bg-bg-warning-soft tw-border-b-border-warning-soft",
  danger: "tw-bg-bg-danger-soft tw-border-b-border-danger-soft",
};

const tileFamily: Record<BannerVariant, DecorativeVariant> = {
  primary: "brand",
  success: "green",
  warning: "orange",
  danger: "red",
};

function composedParent(el: Element): Element | null {
  return el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null);
}

/**
 * The banner component is used to communicate prominent messages or important system states to users.
 * It draws the user's attention to information that requires awareness or action without interrupting their primary task.
 *
 * - Always be dismissible and never use a timeout. If a user dismisses a banner, it should not reappear during that same active session.
 * - Use sparingly, as they can feel intrusive to the user if they appear unexpectedly. Their effectiveness may decrease if too many are used.
 * - Avoid stacking multiple banners.
 * - Avoid overloading banners with information. Keep text short and focused.
 *
 * @slot - Body text
 * @slot actions - Action buttons. Only rendered when `heading` is set.
 * @fires dismiss - The close button was clicked. Only rendered when `dismissible` is set.
 */
@customElement("bit-banner")
export class BitBanner extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* Account for bit-layout's padding (legacy px-8 pt-6, vfo1 px-10) */
      :host([in-layout]) {
        margin-block-start: -1.5rem;
        padding-block-end: 1.5rem;
        margin-inline: -2.5rem;
      }
      :host([in-layout][layout-legacy]) {
        margin-inline: -2rem;
      }
      /* vfo1 zeroes the top padding when the page renders a bit-header */
      :host([in-layout][layout-has-header]:not([layout-legacy])) {
        margin-block-start: 0;
        padding-block-end: 0;
      }
    `,
  ];

  /** Color scheme. */
  @property({ reflect: true }) variant: BannerVariant = "primary";

  /**
   * Heading above the body text. When set, the actions slot is shown and the layout expands.
   */
  @property() heading?: string;

  /** Icon to display. Defaults to an icon based on `variant`; set to `""` to hide it. */
  @property() icon?: BitwardenIcon | "";

  /** Don't announce the banner as a polite live region (`role="status"`). */
  @property({ type: Boolean, attribute: "disable-alert-role" }) disableAlertRole = false;

  /** Shows a close button that fires `dismiss`. */
  @property({ type: Boolean }) dismissible = false;

  @state() private hasActions = false;

  private readonly nav = new SideNavStateController(this);

  connectedCallback() {
    super.connectedCallback();
    let layout: Element | null = composedParent(this);
    while (layout && layout.localName !== "bit-layout") {
      layout = composedParent(layout);
    }
    this.toggleAttribute("in-layout", !!layout);
    this.toggleAttribute("layout-has-header", !!layout?.querySelector("bit-header"));
  }

  protected willUpdate() {
    this.toggleAttribute("layout-legacy", this.nav.state.version === "default");
  }

  private get resolvedIcon() {
    return this.icon === "" ? undefined : (this.icon ?? defaultIcon[this.variant]);
  }

  private onDismiss() {
    this.dispatchEvent(new CustomEvent("dismiss", { bubbles: true, composed: true }));
  }

  private closeButton(extraClasses = "") {
    return html`<bit-icon-button
      class=${extraClasses}
      icon="bwi-close"
      button-type="primaryGhost"
      size="small"
      label=${t("close")}
      @click=${this.onDismiss}
    ></bit-icon-button>`;
  }

  private renderWithHeading(icon: BitwardenIcon | undefined) {
    const family = tileFamily[this.variant];
    return html`<div>
      <div class="tw-flex tw-gap-3 tw-w-full">
        ${
          icon
            ? html`<bit-icon-tile
                  class="@3xl:tw-hidden"
                  icon=${icon}
                  variant=${family}
                  size="sm"
                ></bit-icon-tile>
                <bit-icon-tile
                  class="tw-hidden @3xl:tw-inline-flex"
                  icon=${icon}
                  variant=${family}
                  size="lg"
                ></bit-icon-tile>`
            : nothing
        }
        <div class="tw-flex tw-flex-col tw-gap-3 @3xl:tw-flex-row tw-pe-6 @3xl:tw-pe-0 tw-w-full">
          <div class="@3xl:tw-me-auto">
            <div
              class="!tw-text-sm @3xl:!tw-text-lg tw-text-main tw-font-medium @3xl:!tw-leading-6"
            >
              ${this.heading}
            </div>
            <span class="!tw-text-sm tw-max-w-[800px]" part="message"><slot></slot></span>
          </div>
          <div class="tw-flex tw-gap-3 tw-items-start tw-shrink-0" ?hidden=${!this.hasActions}>
            <slot
              name="actions"
              @slotchange=${(e: Event) =>
                (this.hasActions = (e.target as HTMLSlotElement).assignedElements().length > 0)}
            ></slot>
          </div>
          ${this.dismissible ? this.closeButton("tw-hidden @3xl:tw-inline-block") : nothing}
        </div>
        ${
          this.dismissible
            ? html`<div class="tw-absolute tw-end-2 tw-top-2 tw-block @3xl:tw-hidden">
                ${this.closeButton()}
              </div>`
            : nothing
        }
      </div>
    </div>`;
  }

  private renderSimple(icon: BitwardenIcon | undefined) {
    return html`<div class=${this.dismissible ? "tw-pe-6" : ""}>
      <div class="tw-flex tw-items-start tw-gap-3 @3xl:tw-justify-center">
        ${
          icon
            ? html`<bit-icon-tile
                icon=${icon}
                variant=${tileFamily[this.variant]}
                size="sm"
              ></bit-icon-tile>`
            : nothing
        }
        <span class="!tw-text-sm tw-mt-0.5 tw-max-w-[800px]" part="message"><slot></slot></span>
      </div>
      ${
        this.dismissible
          ? html`<div class="tw-absolute tw-end-2 tw-top-3">${this.closeButton()}</div>`
          : nothing
      }
    </div>`;
  }

  render() {
    const icon = this.resolvedIcon;
    return html`<div class="tw-@container tw-flex tw-flex-col">
      <div
        class="tw-relative tw-border-solid tw-border-b tw-border-0 tw-p-4 tw-text-main ${
          bannerColors[this.variant]
        }"
        role=${this.disableAlertRole ? nothing : "status"}
        aria-live=${this.disableAlertRole ? nothing : "polite"}
      >
        ${this.heading ? this.renderWithHeading(icon) : this.renderSimple(icon)}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-banner": BitBanner;
  }
}
