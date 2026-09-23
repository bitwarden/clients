import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { DurationUnit, pickDurationUnit } from "..";

/**
 * Compact, localized lease-duration label, e.g. `15m`, `1h`, `4h`, `1d`.
 * Picks the largest whole unit the value divides into evenly (via
 * {@link pickDurationUnit}) and renders it with `Intl.NumberFormat`'s
 * `style: "unit"`, so the unit label follows the active locale.
 */
@Pipe({
  name: "durationShort",
})
export class DurationShortPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  private readonly formatters = new Map<DurationUnit, Intl.NumberFormat>();

  transform(seconds: number): string {
    const { value, unit } = pickDurationUnit(seconds);
    return this.formatterFor(unit).format(value);
  }

  private formatterFor(unit: DurationUnit): Intl.NumberFormat {
    let formatter = this.formatters.get(unit);
    if (!formatter) {
      formatter = new Intl.NumberFormat(this.locale, {
        style: "unit",
        unit,
        unitDisplay: "narrow",
      });
      this.formatters.set(unit, formatter);
    }
    return formatter;
  }
}
