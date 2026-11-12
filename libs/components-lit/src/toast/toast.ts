import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import "../icon-button/icon-button";

export type ToastVariant = "success" | "error" | "info" | "warning";

const variants: Record<ToastVariant, { icon: string; bgColor: string }> = {
  success: { icon: "bwi-check-circle", bgColor: "tw-bg-success-100" },
  error: { icon: "bwi-error", bgColor: "tw-bg-danger-100" },
  info: { icon: "bwi-info-circle", bgColor: "tw-bg-info-100" },
  warning: { icon: "bwi-exclamation-triangle", bgColor: "tw-bg-warning-100" },
};

/**
 * Ephemeral notification, usually the result of a user action. Show toasts with `showToast()`;
 * use this element directly only for static previews.
 *
 * @fires dismissed - The close button was pressed.
 */
@customElement("bit-toast")
export class BitToast extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @property({ reflect: true }) variant: ToastVariant = "info";

  /** Pass an array to render multiple paragraphs. */
  @property({ attribute: false }) message: string | string[] = "";

  /** Optional title above the message. (`title` would show a native tooltip.) */
  @property() heading?: string;

  /** Width of the progress bar, 0–100. */
  @property({ type: Number, attribute: "progress-width" }) progressWidth = 0;

  private onClose = () => {
    this.dispatchEvent(new CustomEvent("dismissed", { bubbles: true, composed: true }));
  };

  render() {
    const { icon, bgColor } = variants[this.variant] ?? variants.info;
    const messages = Array.isArray(this.message) ? this.message : [this.message];
    return html`<div
      part="base"
      class="tw-mb-1 tw-min-w-[var(--bit-toast-width,19rem)] tw-text-main tw-flex tw-flex-col tw-justify-between tw-rounded-md tw-pointer-events-auto tw-cursor-default tw-overflow-hidden tw-shadow-lg ${bgColor}"
    >
      <div class="tw-flex tw-items-center tw-gap-4 tw-px-2 tw-pb-1 tw-pt-2">
        <i aria-hidden="true" class="bwi tw-text-xl tw-py-1.5 tw-px-2.5 ${icon}"></i>
        <div>
          <span class="tw-sr-only">${t(this.variant)}</span>
          ${
            this.heading
              ? html`<p data-testid="toast-title" class="tw-font-medium tw-m-0">${this.heading}</p>`
              : nothing
          }
          ${messages.map(
            (message) =>
              html`<p data-testid="toast-message" class="tw-text-sm tw-mt-0 tw-mb-2 last:tw-mb-0">
                ${message}
              </p>`,
          )}
        </div>
        <bit-icon-button
          data-testid="bit-toast-close"
          class="tw-ms-auto"
          icon="bwi-close"
          button-type="primaryGhost"
          size="small"
          label=${t("close")}
          @click=${this.onClose}
        ></bit-icon-button>
      </div>
      <div
        class="tw-h-1 tw-w-full tw-bg-text-main/30"
        style=${styleMap({ width: `${this.progressWidth}%` })}
      ></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-toast": BitToast;
  }
}
