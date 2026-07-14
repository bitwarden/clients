import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Presentational circular gauge for the vault-health "at risk" score.
 *
 * Fills a circular arc to the `value / total` proportion and renders the
 * percentage plus an "at risk" label centered inside the ring. Color is binary:
 * green when `value` is 0 (empty), red for any fill (`value` greater than 0).
 * A `total` of 0 (or any non-positive total) renders an empty, green gauge
 * without a divide-by-zero.
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

  /** The at-risk count. 0 renders an empty, green gauge. */
  readonly value = input<number>(0);
  /** The total the value is measured against. 0 (or less) renders empty without error. */
  readonly total = input<number>(0);

  /** True only when there is a positive total and a positive value. Drives the red state and the fill. */
  protected readonly isAtRisk = computed(() => this.total() > 0 && this.value() > 0);

  /** Fill proportion in [0, 1]. Forced to 0 when not at risk (also covers total <= 0). */
  protected readonly fillFraction = computed(() =>
    this.isAtRisk() ? Math.min(1, Math.max(0, this.value() / this.total())) : 0,
  );

  /**
   * Rounded integer percentage shown inside the ring. 0 when total <= 0, and
   * clamped to 100 so a value greater than the total stays consistent with the
   * fully-filled ring.
   */
  protected readonly percentage = computed(() =>
    this.total() > 0 ? Math.min(100, Math.round((this.value() / this.total()) * 100)) : 0,
  );

  /**
   * SVG stroke-dashoffset for the fill arc. The ring's radius (15.9155) makes its
   * circumference ~100, so the offset is simply 100 minus the filled percent.
   */
  protected readonly strokeDashoffset = computed(() => 100 - this.fillFraction() * 100);

  /** Track ring color: green when clean, neutral when at risk. */
  protected readonly trackStrokeClass = computed(() =>
    this.isAtRisk() ? "tw-stroke-bg-quaternary" : "tw-stroke-bg-success",
  );

  /** Localized accessible summary announced by screen readers, e.g. "37% at risk". */
  protected readonly accessibleValueText = computed(
    () => `${this.percentage()}% ${this.i18nService.t("atRisk")}`,
  );
}
