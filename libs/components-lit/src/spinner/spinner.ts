import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

export type SpinnerVariant = "primary" | "subtle" | "success" | "warning" | "danger" | "contrast";

export type SpinnerSize = "sm" | "md" | "base" | "lg";

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "tw-size-4",
  md: "tw-size-6",
  base: "tw-size-14",
  lg: "tw-size-20",
};

const variantStyles: Record<SpinnerVariant, { foreground: string; background: string }> = {
  primary: { foreground: "tw-stroke-bg-brand", background: "tw-stroke-bg-quaternary" },
  subtle: { foreground: "tw-stroke-bg-contrast", background: "tw-stroke-bg-quaternary" },
  success: { foreground: "tw-stroke-bg-success", background: "tw-stroke-bg-quaternary" },
  warning: { foreground: "tw-stroke-bg-warning", background: "tw-stroke-bg-quaternary" },
  danger: { foreground: "tw-stroke-bg-danger", background: "tw-stroke-bg-quaternary" },
  contrast: { foreground: "tw-stroke-bg-primary", background: "tw-stroke-bg-contrast-soft" },
};

/** Indeterminate loading indicator. */
@customElement("bit-spinner")
export class BitSpinner extends BitElement {
  /** Color scheme. */
  @property({ reflect: true }) variant: SpinnerVariant = "primary";

  @property({ reflect: true }) size: SpinnerSize = "base";

  /** Screen reader text; not visually rendered. Defaults to "Loading". Set to `""` to omit. */
  @property() label?: string;

  render() {
    const label = this.label ?? t("loading");
    const colors = variantStyles[this.variant];
    return html`
      <div class="tw-inline-block tw-align-middle ${sizeStyles[this.size]}">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 56 56"
          fill="none"
          class="tw-size-full tw-animate-spin tw-flex"
          aria-hidden="true"
        >
          <circle cx="28" cy="28" r="23" class=${colors.background} stroke-width="5" />
          <circle
            cx="28"
            cy="28"
            r="23"
            class=${colors.foreground}
            pathLength="4"
            stroke-width="5"
            stroke-dasharray="1 3"
            stroke-linecap="round"
          />
        </svg>
        ${label ? html`<span class="tw-sr-only">${label}</span>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-spinner": BitSpinner;
  }
}
