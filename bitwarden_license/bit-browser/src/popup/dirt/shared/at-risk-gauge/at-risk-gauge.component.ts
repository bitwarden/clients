import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Presentational 270° arc gauge for a vault-health "at risk" score. Fills a
 * circular arc to `value / total`, with the percentage and an "at risk" label
 * centered inside; green when empty, red for any at-risk value. Derives
 * everything from its inputs (no data fetching, no outputs).
 */
@Component({
  selector: "dirt-at-risk-gauge",
  templateUrl: "./at-risk-gauge.component.html",
  imports: [TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtRiskGaugeComponent {
  private readonly i18nService = inject(I18nService);

  // Track arc length in ring-circumference units (~100, radius 15.9155):
  // 75 = a 270° sweep, leaving a 90° (25-unit) gap at the bottom.
  private static readonly ARC_LENGTH = 75;

  /** The number of at-risk items. */
  readonly value = input<number>(0);
  /** The total number of items the count is measured against. */
  readonly total = input<number>(0);
  /** Accessible name for the progressbar; falls back to a localized default when omitted. */
  readonly accessibleName = input<string>();

  protected readonly isAtRisk = computed(() => this.total() > 0 && this.value() > 0);

  /** Fill proportion of the arc, from 0 (empty) to 1 (full). */
  protected readonly fillFraction = computed(() =>
    // A non-positive total renders an empty gauge instead of dividing by zero.
    this.isAtRisk() ? Math.min(1, Math.max(0, this.value() / this.total())) : 0,
  );

  /** Whole-number percentage shown inside the arc. */
  protected readonly percentage = computed(() => {
    if (this.total() <= 0) {
      return 0;
    }
    const rounded = Math.min(100, Math.round((this.value() / this.total()) * 100));
    // Floor to 1 while at risk so a red gauge never reads "0%" for a small nonzero fraction.
    return this.isAtRisk() ? Math.max(1, rounded) : rounded;
  });

  /** `stroke-dasharray` for the red fill arc (filled length of the 270° arc, then a gap). */
  protected readonly fillDashArray = computed(
    () => `${this.fillFraction() * AtRiskGaugeComponent.ARC_LENGTH} 100`,
  );

  protected readonly trackStrokeClass = computed(() =>
    this.isAtRisk() ? "tw-stroke-danger-100" : "tw-stroke-success-100",
  );

  protected readonly percentageTextClass = computed(() =>
    this.isAtRisk() ? "tw-text-danger-600" : "tw-text-success-600",
  );

  /** Localized value text announced by screen readers, e.g. "37% at risk". */
  protected readonly accessibleValueText = computed(
    () => `${this.percentage()}% ${this.i18nService.t("atRisk")}`,
  );

  protected readonly accessibleNameComputed = computed(
    () => this.accessibleName() ?? this.i18nService.t("atRiskPasswords"),
  );
}
