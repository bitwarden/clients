import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { BitwardenIcon } from "../icon/shared-icon";
import "../spinner/spinner";

import { BitButtonBase } from "./button-base";
import { ButtonType, getButtonColorStyles } from "./button-styles";

export type ButtonSize = "default" | "small" | "large";

const sizeStyles: Record<ButtonSize, string> = {
  // 1px less vertical padding to account for the border, keeping heights consistent with icon buttons.
  small:
    "tw-pt-[calc(theme(spacing.2)_-_1px)] tw-pb-[calc(theme(spacing.2)_-_1px)] tw-px-3 tw-text-xs/4",
  default: "tw-pt-[calc(0.625rem_-_1px)] tw-pb-[calc(0.625rem_-_1px)] tw-px-4 tw-text-sm/5",
  large:
    "tw-pt-[calc(theme(spacing.3)_-_1px)] tw-pb-[calc(theme(spacing.3)_-_1px)] tw-px-4 tw-text-base/6",
};

/**
 * Button. Renders an `<a>` when `href` is set. Participates in its form like a native button.
 *
 * Disabled and loading buttons stay focusable (`aria-disabled`) and swallow clicks.
 *
 * @slot - Label
 */
@customElement("bit-button")
export class BitButton extends BitButtonBase {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-block;
      }
      :host([block]) {
        display: block;
      }
      [part="base"] {
        width: 100%;
      }
    `,
  ];

  @property({ attribute: "button-type", reflect: true }) buttonType: ButtonType = "secondary";

  @property({ reflect: true }) size: ButtonSize = "default";

  /** Stretch to the container's width. */
  @property({ type: Boolean, reflect: true }) block = false;

  @property({ attribute: "start-icon" }) startIcon?: BitwardenIcon;

  @property({ attribute: "end-icon" }) endIcon?: BitwardenIcon;

  @property() href?: string;

  @property() target?: string;

  @property() rel?: string;

  @property() download?: string;

  /** Accessible name when the label isn't descriptive enough. */
  @property() label?: string;

  render() {
    const classes = [
      "tw-rounded-xl",
      this.block ? "tw-w-full tw-block" : "tw-inline-block",
      sizeStyles[this.size],
      ...getButtonColorStyles({
        buttonType: this.buttonType,
        isDisabled: this.showSpinner || this.isInactive,
      }),
    ].join(" ");

    const content = html`
      <span class="tw-relative tw-flex tw-items-center tw-justify-center">
        <span class="tw-flex tw-items-center tw-gap-2 ${this.showSpinner ? "tw-invisible" : ""}">
          ${this.startIcon ? html`<i class="bwi ${this.startIcon}" aria-hidden="true"></i>` : nothing}
          <span><slot></slot></span>
          ${this.endIcon ? html`<i class="bwi ${this.endIcon}" aria-hidden="true"></i>` : nothing}
        </span>
        ${
          this.showSpinner
            ? html`<span class="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
                <bit-spinner size=${this.size === "small" ? "sm" : "md"}></bit-spinner>
              </span>`
            : nothing
        }
      </span>
    `;

    if (this.href) {
      return html`<a
        part="base"
        class=${classes}
        href=${this.isInactive ? nothing : this.href}
        target=${this.target ?? nothing}
        rel=${this.rel ?? nothing}
        download=${this.download ?? nothing}
        role=${this.isInactive ? "link" : nothing}
        aria-label=${this.label ?? nothing}
        aria-disabled=${this.isInactive ? "true" : nothing}
        tabindex=${this.isInactive ? "0" : nothing}
        @click=${this.onClick}
        >${content}</a
      >`;
    }

    return html`<button
      part="base"
      type="button"
      class=${classes}
      aria-label=${this.label ?? nothing}
      aria-disabled=${this.isInactive ? "true" : nothing}
      @click=${this.onClick}
    >
      ${content}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-button": BitButton;
  }
}
