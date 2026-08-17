import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { DurationUnit, pickDurationUnit } from "..";

/**
 * Spelled-out, localized lease-duration label, e.g. `15 minutes`, `1 hour`, `4 hours`,
 * `1 day`. The long-form sibling of {@link DurationShortPipe}: same unit selection (via
 * {@link pickDurationUnit}), rendered with `Intl.NumberFormat`'s `style: "unit"` and
 * `unitDisplay: "long"`, so both the unit label and its plural form follow the active
 * locale rather than a hand-rolled English string.
 */
@Pipe({
  name: "durationLong",
})
export class DurationLongPipe implements PipeTransform {
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
        unitDisplay: "long",
      });
      this.formatters.set(unit, formatter);
    }
    return formatter;
  }
}
