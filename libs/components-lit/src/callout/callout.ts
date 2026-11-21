import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import { uniqueId } from "../core/ids";
import "../icon/icon";
import "../icon-button/icon-button";
import { BitwardenIcon } from "../icon/shared-icon";

export type CalloutType = "success" | "info" | "warning" | "danger" | "subtle";

const defaultIcon: Record<CalloutType, BitwardenIcon> = {
  success: "bwi-check-circle",
  info: "bwi-info-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
  subtle: "bwi-info-circle",
};

const defaultI18n: Partial<Record<CalloutType, string>> = {
  warning: "warning",
  danger: "error",
};

const variantClass: Record<CalloutType, string> = {
  danger: "tw-bg-bg-danger-soft tw-border-border-danger-soft",
  info: "tw-bg-bg-brand-softer tw-border-border-brand-soft",
  success: "tw-bg-bg-success-soft tw-border-border-success-soft",
  warning: "tw-bg-bg-warning-soft tw-border-border-warning-soft",
  subtle: "tw-bg-bg-secondary tw-border-border-base",
};

const fgClass: Record<CalloutType, string> = {
  danger: "!tw-text-fg-danger-strong",
  info: "!tw-text-fg-brand-strong",
  success: "!tw-text-fg-success-strong",
  warning: "!tw-text-fg-warning-strong",
  subtle: "!tw-text-fg-heading",
};

let instanceCount = 0;

/**
 * The callout component provides information to your users such as success or error messages,
 * but also highlighted information complementing the normal flow of paragraphs and headers on a page.
 * Whereas a banner is meant to be used globally across pages, the callout can be used more contextually
 * within other components / in the more standard flow of information.
 *
 * @slot - Message
 * @slot title - Content rendered before the heading text
 * @slot end - Footer actions, typically buttons
 * @fires dismiss - The close button was clicked. Only rendered when `dismissible` is set.
 */
@customElement("bit-callout")
export class BitCallout extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      .end ::slotted(*) {
        margin-top: 1rem;
      }
      .close::part(base) {
        color: inherit;
      }
    `,
  ];

  @property({ reflect: true }) type: CalloutType = "info";

  /**
   * Icon to display. Defaults to an icon based on `type`; set to `""` to hide the icon.
   */
  @property() icon?: BitwardenIcon | "";

  /**
   * Heading text. `warning` and `danger` default to a localized heading; set to `""` to hide it.
   */
  @property() heading?: string;

  /** Screen reader name for the landmark when there's no heading. */
  @property({ attribute: "accessible-name" }) accessibleName?: string;

  /** Shows a close button that fires `dismiss`. */
  @property({ type: Boolean }) dismissible = false;

  private readonly instance = instanceCount++;
  private readonly titleId = uniqueId("bit-callout-title");

  private get resolvedIcon() {
    return this.icon === "" ? undefined : this.icon || defaultIcon[this.type];
  }

  private get resolvedHeading() {
    if (this.heading === "") {
      return undefined;
    }
    const key = defaultI18n[this.type];
    return this.heading ?? (key ? t(key) : undefined);
  }

  private onDismiss() {
    this.dispatchEvent(new CustomEvent("dismiss", { bubbles: true, composed: true }));
  }

  render() {
    const heading = this.resolvedHeading;
    const icon = this.resolvedIcon;
    const classes = [
      "tw-mb-4 tw-border tw-border-solid tw-rounded-xl tw-ps-4 tw-pe-2 tw-flex tw-flex-col tw-relative",
      variantClass[this.type],
      fgClass[this.type],
      heading ? "tw-pt-3 tw-pb-4" : "tw-py-2",
    ].join(" ");
    const content = html`<div class="!tw-text-sm tw-pr-4" part="message">
      <slot></slot>
    </div>`;

    return html`
      <aside
        class=${classes}
        aria-labelledby=${heading ? this.titleId : nothing}
        aria-label=${
          heading
            ? nothing
            : (this.accessibleName ?? `${t("callout")} ${this.instance + 1}, ${this.type}`)
        }
      >
        <div class="tw-flex tw-flex-col tw-gap-2">
          <div class="tw-flex tw-justify-between">
            <div class="tw-flex tw-gap-2 tw-items-baseline ${this.dismissible ? "tw-pt-1.5" : ""}">
              ${icon ? html`<bit-icon name=${icon}></bit-icon>` : nothing}
              ${
                heading
                  ? html`<header id=${this.titleId} class="tw-text-base tw-font-medium">
                      <slot name="title"></slot>
                      ${heading}
                    </header>`
                  : content
              }
            </div>
            ${
              this.dismissible
                ? html`<bit-icon-button
                    class="close tw-shrink-0"
                    icon="bwi-close"
                    button-type="subtleGhost"
                    size="small"
                    label=${t("close")}
                    @click=${this.onDismiss}
                  ></bit-icon-button>`
                : nothing
            }
          </div>
          ${heading ? content : nothing}
        </div>
        <div class="end tw-flex tw-gap-3">
          <slot name="end"></slot>
        </div>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-callout": BitCallout;
  }
}
