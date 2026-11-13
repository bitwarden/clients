import { css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import { uniqueId } from "../core/ids";

export type ProgressBarVariant = "primary" | "subtle" | "success" | "warning" | "danger";

const variantClasses: Record<ProgressBarVariant, string> = {
  primary: "tw-bg-primary-600",
  subtle: "tw-bg-bg-contrast",
  success: "tw-bg-success-600",
  warning: "tw-bg-warning-600",
  danger: "tw-bg-danger-600",
};

let instanceCount = 0;

/**
 * The progress bar component represents a determinate progress state, visually indicating how much of an action or load has been completed and how much remains.
 * By showing measurable progress, it helps users understand timing and sets clear expectations for more static progress indications.
 *
 * Progress bars can be used on their own, as in full-page loading or multi-step processes, or embedded within components like cards, panels,
 * or dialogs when progress is tied to a specific task.
 *
 * @slot label - Visible label; also the progress bar's accessible name
 * @slot start - Hint below the bar's start. Defaults to "N% complete".
 * @slot end - Hint below the bar's end
 */
@customElement("bit-progress-bar")
export class BitProgressBar extends BitElement implements AriaTargetHost {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Hides the default start hint text. */
  @property({ type: Boolean, attribute: "hide-start-hint" }) hideStartHint = false;

  /** Determines the color of the progress bar. */
  @property({ reflect: true }) variant: ProgressBarVariant = "primary";

  /** Percentage of the bar that is filled, clamped between 0 and 100. */
  @property({ type: Number }) value = 0;

  /** Overrides the default accessible value text. */
  @property({ attribute: "aria-value-text" }) ariaValueTextOverride?: string;

  /** Screen reader name when no label is slotted. */
  @property({ attribute: "accessible-name" }) accessibleName?: string;

  /** The `role="progressbar"` element, for `aria-describedby` via element reflection. */
  @query("[role=progressbar]") readonly ariaTarget!: HTMLElement | null;

  @state() private hasLabel = false;

  private readonly instance = instanceCount++;
  private readonly labelId = uniqueId("bit-progress-bar-label");

  private get clampedValue() {
    return Math.max(0, Math.min(100, Number(this.value) || 0));
  }

  render() {
    const value = this.clampedValue;
    return html`<div class="tw-flex tw-flex-col">
      <div
        id=${this.labelId}
        class="tw-text-base tw-text-main tw-font-medium ${this.hasLabel ? "tw-mb-1" : "tw-mb-0"}"
      >
        <slot
          name="label"
          @slotchange=${(e: Event) =>
            (this.hasLabel = (e.target as HTMLSlotElement).assignedNodes().length > 0)}
          ><span class="tw-sr-only"
            >${this.accessibleName ?? `${t("progressBar")} ${this.instance + 1}`}</span
          ></slot
        >
      </div>
      <div class="tw-overflow-hidden tw-rounded tw-bg-secondary-100 tw-h-2 tw-my-1">
        <div
          part="bar"
          class="tw-transition-all tw-h-2 tw-rounded ${variantClasses[this.variant]}"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${value}
          aria-valuetext=${this.ariaValueTextOverride ?? nothing}
          aria-labelledby=${this.labelId}
          style=${styleMap({ width: `${value}%` })}
        ></div>
      </div>
      <div class="tw-flex tw-text-fg-body tw-text-sm">
        ${
          this.hideStartHint
            ? nothing
            : html`<div class="tw-me-auto tw-text-muted tw-text-xs tw-mt-1">
                <slot name="start">${t("percentageCompleted", String(value))}</slot>
              </div>`
        }
        <div class="tw-ms-auto tw-text-muted tw-text-xs tw-mt-1"><slot name="end"></slot></div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-progress-bar": BitProgressBar;
  }
}
