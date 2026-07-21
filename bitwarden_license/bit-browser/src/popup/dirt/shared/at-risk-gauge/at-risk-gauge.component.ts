import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Presentational 270° arc gauge for the vault-health "at risk" score.
 *
 * Renders an open circular arc (a 270° sweep with a 90° gap at the bottom) that
 * fills to the `value / total` proportion, with the percentage and an "at risk"
 * label centered inside. Color is binary, matching the design:
 * - empty (`value` is 0): a light green track, green percentage;
 * - any fill (`value` greater than 0): a light red track with a solid red fill
 *   arc and a red percentage.
 * There is no amber or intermediate state. A `total` of 0 (or any non-positive
 * total) renders an empty, green gauge without a divide-by-zero.
 *
 * Purely presentational: it derives everything from its inputs, fetches no data,
 * and emits no events.
 */
@Component({
  selector: "dirt-at-risk-gauge",
  templateUrl: "./at-risk-gauge.component.html",
  imports: [TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtRiskGaugeComponent {
  private readonly i18nService = inject(I18nService);

  /**
   * Length of the visible track arc, in the same units as the ring circumference
   * (~100, from radius 15.9155). 75 units = a 270° sweep, leaving a 90° (25-unit)
   * gap at the bottom.
   */
  private static readonly ARC_LENGTH = 75;

  /** The at-risk count. 0 renders an empty, green gauge. */
  readonly value = input<number>(0);
  /** The total the value is measured against. 0 (or less) renders empty without error. */
  readonly total = input<number>(0);
  /**
   * Accessible name for the progressbar. Consumers should pass the gauge's
   * purpose (e.g. the Health Overview's context); falls back to a localized
   * default so the control is never unnamed.
   */
  readonly accessibleName = input<string>();

  /** True only when there is a positive total and a positive value. Drives the red state and the fill. */
  protected readonly isAtRisk = computed(() => this.total() > 0 && this.value() > 0);

  /** Fill proportion in [0, 1]. Forced to 0 when not at risk (also covers total <= 0). */
  protected readonly fillFraction = computed(() =>
    this.isAtRisk() ? Math.min(1, Math.max(0, this.value() / this.total())) : 0,
  );

  /**
   * Rounded integer percentage shown inside the arc. 0 when total <= 0, and
   * clamped to 100 so a value greater than the total stays consistent with the
   * fully-filled arc. While at risk it is floored to 1 so a red gauge never
   * misleadingly reads "0%" for a small-but-nonzero fraction (e.g. 1 / 1000).
   */
  protected readonly percentage = computed(() => {
    if (this.total() <= 0) {
      return 0;
    }
    const rounded = Math.min(100, Math.round((this.value() / this.total()) * 100));
    return this.isAtRisk() ? Math.max(1, rounded) : rounded;
  });

  /**
   * `stroke-dasharray` for the red fill arc: the filled length (a fraction of the
   * 270° arc) followed by a gap larger than the ring so only the fill shows.
   */
  protected readonly fillDashArray = computed(
    () => `${this.fillFraction() * AtRiskGaugeComponent.ARC_LENGTH} 100`,
  );

  /** Track arc color: light green when clean, light red when at risk. */
  protected readonly trackStrokeClass = computed(() =>
    this.isAtRisk() ? "tw-stroke-danger-100" : "tw-stroke-success-100",
  );

  /** Percentage text color: green when clean, red when at risk (matches the design). */
  protected readonly percentageTextClass = computed(() =>
    this.isAtRisk() ? "tw-text-danger-600" : "tw-text-success-600",
  );

  /** Localized accessible summary announced by screen readers, e.g. "37% at risk". */
  protected readonly accessibleValueText = computed(
    () => `${this.percentage()}% ${this.i18nService.t("atRisk")}`,
  );

  /** Accessible name for the progressbar: the caller-supplied name or a localized fallback. */
  protected readonly accessibleNameComputed = computed(
    () => this.accessibleName() ?? this.i18nService.t("atRiskPasswords"),
  );
}
