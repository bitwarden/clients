import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import { BitSvg, isBitSvg } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

import "../berry/berry";

export type BottomNavigationButton = {
  /** i18n key for the label. */
  label: string;
  href: string;
  icon: BitSvg;
  iconActive: BitSvg;
  /** Whether this is the current page. Replaces Angular's `routerLinkActive`. */
  active?: boolean;
  showBerry?: boolean;
};

/**
 * Bottom tab bar for the browser extension popup. Each button is a link; mark the current page with
 * `active`. Renders nothing when `navButtons` is empty.
 */
@customElement("bit-bottom-navigation")
export class BitBottomNavigation extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* Tailwind doesn't scan libs/assets, so define the fills the nav icons use. */
      svg .tw-fill-fg-body {
        fill: var(--color-fg-body);
      }
      svg .tw-fill-fg-brand {
        fill: var(--color-fg-brand);
      }
    `,
  ];

  @property({ attribute: false }) navButtons: BottomNavigationButton[] = [];

  private buttonTitle(button: BottomNavigationButton) {
    const label = t(button.label);
    return button.showBerry ? t("labelWithNotification", label) : label;
  }

  private renderIcon(icon: BitSvg) {
    // Rendered inline (not via bit-svg) so the hover/focus fill rules below can reach the paths.
    // Safe: `BitSvg` can only be created by the `svg` tag, which rejects interpolated values.
    return isBitSvg(icon)
      ? html`<span class="tw-flex tw-justify-center tw-leading-3" aria-hidden="true"
          >${unsafeSVG(icon.svg)}</span
        >`
      : nothing;
  }

  render() {
    if (!this.navButtons.length) {
      return nothing;
    }
    return html`<footer
      class="tw-bg-bg-primary tw-border-0 tw-border-t tw-border-border-base tw-border-solid"
    >
      <div class="tw-max-w-screen-sm tw-mx-auto">
        <nav>
          <ul class="tw-flex tw-flex-1 tw-mb-0 tw-p-1">
            ${this.navButtons.map((button) => {
              const title = this.buttonTitle(button);
              return html`<li class="tw-flex-1 tw-list-none tw-relative">
                <a
                  href=${button.href}
                  title=${title}
                  aria-label=${title}
                  aria-current=${button.active ? "page" : nothing}
                  class="tw-w-full tw-rounded-md tw-flex tw-flex-col tw-gap-0.5 tw-items-center tw-py-1 tw-px-2 bit-compact:tw-py-1 tw-bg-transparent tw-transition-colors tw-no-underline hover:tw-no-underline hover:tw-text-fg-brand hover:tw-bg-bg-brand-softer focus-visible:tw-ring-2 focus-visible:tw-ring-inset focus-visible:tw-ring-border-focus focus-visible:tw-outline-none focus-visible:tw-text-fg-brand focus-visible:tw-bg-bg-brand-softer [&:hover:not([aria-current=page])_svg_path]:tw-fill-fg-brand [&:focus-visible:not([aria-current=page])_svg_path]:tw-fill-fg-brand ${
                    button.active ? "tw-font-semibold tw-text-fg-brand" : "tw-text-fg-body"
                  }"
                >
                  <div class="tw-relative">
                    ${
                      button.showBerry
                        ? html`<div class="tw-flex tw-absolute tw-top-0 tw-right-0">
                            <bit-berry type="status" variant="danger"></bit-berry>
                          </div>`
                        : nothing
                    }
                    ${this.renderIcon(button.active ? button.iconActive : button.icon)}
                  </div>
                  <span class="tw-text-xs tw-truncate tw-max-w-full">${t(button.label)}</span>
                </a>
              </li>`;
            })}
          </ul>
        </nav>
      </div>
    </footer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-bottom-navigation": BitBottomNavigation;
  }
}
