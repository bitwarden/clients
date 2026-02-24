import { ChangeDetectionStrategy, Component, computed, inject, model } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MenuModule } from "@bitwarden/components";

import { DEFAULT_TIME_PERIOD, PERIOD_OPTIONS, TimePeriod } from "./period-selector.types";

/** Pre-computed option with translated label for template rendering */
interface TranslatedPeriodOption {
  value: TimePeriod;
  label: string;
}

@Component({
  selector: "dirt-period-selector",
  templateUrl: "./period-selector.component.html",
  imports: [MenuModule, JslibModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodSelectorComponent {
  private i18nService = inject(I18nService);

  /**
   * The currently selected time period. Supports two-way binding via [(selectedPeriod)].
   * Defaults to "Past month" (TimePeriod.PastMonth).
   */
  readonly selectedPeriod = model<TimePeriod>(DEFAULT_TIME_PERIOD);

  /**
   * Pre-translated period options for the dropdown.
   * Labels are resolved once at construction time (i18n is static at runtime).
   */
  protected readonly periodOptions: TranslatedPeriodOption[] = PERIOD_OPTIONS.map((o) => ({
    value: o.value,
    label: this.i18nService.t(o.labelKey),
  }));

  /** O(1) label lookup map for the selected period display */
  private readonly labelMap = Object.freeze(
    Object.fromEntries(this.periodOptions.map((o) => [o.value, o.label])),
  ) as Readonly<Record<TimePeriod, string>>;

  /** Translated label for the currently selected period */
  protected readonly selectedLabel = computed(() => {
    return this.labelMap[this.selectedPeriod()] ?? this.periodOptions[0].label;
  });

  /** Handle period selection */
  protected selectPeriod(period: TimePeriod): void {
    this.selectedPeriod.set(period);
  }
}
