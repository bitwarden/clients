import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export type SpinnerVariant = "primary" | "subtle" | "success" | "warning" | "danger" | "contrast";

export type SpinnerSize = "sm" | "md" | "base" | "lg";

export const spinnerSizeStyles: Record<SpinnerSize, string[]> = {
  sm: ["tw-size-4"],
  md: ["tw-size-6"],
  base: ["tw-size-14"],
  lg: ["tw-size-20"],
};

const spinnerVariantStyles: Record<SpinnerVariant, { foreground: string; background: string }> = {
  primary: {
    foreground: "tw-stroke-bg-brand",
    background: "tw-stroke-bg-quaternary",
  },
  subtle: {
    foreground: "tw-stroke-bg-contrast",
    background: "tw-stroke-bg-quaternary",
  },
  success: {
    foreground: "tw-stroke-bg-success",
    background: "tw-stroke-bg-quaternary",
  },
  warning: {
    foreground: "tw-stroke-bg-warning",
    background: "tw-stroke-bg-quaternary",
  },
  danger: {
    foreground: "tw-stroke-bg-danger",
    background: "tw-stroke-bg-quaternary",
  },
  contrast: {
    foreground: "tw-stroke-bg-primary",
    background: "tw-stroke-bg-contrast-soft",
  },
};

@Component({
  selector: "bit-spinner",
  templateUrl: "spinner.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-inline-block" },
})
export class SpinnerComponent {
  private readonly i18nService = inject(I18nService);

  readonly variant = input<SpinnerVariant>("primary");
  readonly size = input<SpinnerSize>("base");
  /**
   * for accessibility, not visually rendered
   */
  readonly title = input<string>(this.i18nService.t("loading"));

  readonly variantClasses = computed(() => spinnerVariantStyles[this.variant()]);
  readonly sizeClasses = computed(() => spinnerSizeStyles[this.size()]);
}
