import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

import { SideNavStateController } from "./side-nav-state";
import "../icon-button/icon-button";

/**
 * An empty-state message shown inside a `bit-nav-section` when the section has no items.
 * Renders a subtle bordered box with the slotted message and, when `dismissible`, a close button.
 * Hidden when the side nav is collapsed.
 *
 * @slot - The message.
 * @fires dismiss - The close button was clicked. The consumer owns hiding and persistence.
 */
@customElement("bit-nav-section-empty")
export class BitNavSectionEmpty extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      bit-icon-button::part(base) {
        border: 0;
      }
      bit-icon-button::part(base):hover,
      bit-icon-button::part(base):focus-visible {
        background-color: var(--color-nav-bg-brand-hover);
      }
    `,
  ];

  /** Shows a close button that fires `dismiss`. Replaces detecting a bound `(dismiss)` output. */
  @property({ type: Boolean, reflect: true }) dismissible = false;

  private readonly nav = new SideNavStateController(this);

  private onDismiss() {
    this.dispatchEvent(new CustomEvent("dismiss", { bubbles: true, composed: true }));
  }

  render() {
    if (!this.nav.state.open) {
      return nothing;
    }
    return html`<div
      class="tw-relative tw-mt-1 tw-mx-2 tw-rounded-lg tw-border tw-border-solid tw-border-border-nav-divider tw-p-3 tw-text-sm tw-text-fg-nav-heading"
    >
      ${
        this.dismissible
          ? html`<div class="tw-absolute tw-end-1 tw-top-1">
              <bit-icon-button
                icon="bwi-close"
                button-type="unstyled"
                size="small"
                label=${t("close")}
                @click=${this.onDismiss}
              ></bit-icon-button>
            </div>`
          : nothing
      }
      <div class=${this.dismissible ? "tw-pe-6" : ""}>
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-nav-section-empty": BitNavSectionEmpty;
  }
}
