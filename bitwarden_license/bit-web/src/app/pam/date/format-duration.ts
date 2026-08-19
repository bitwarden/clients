import { DurationUnit, pickDurationUnit } from "..";

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Renders a duration in seconds as a localized label: picks the largest whole unit the
 * duration divides into (via {@link pickDurationUnit}) and formats it with
 * `Intl.NumberFormat`'s `style: "unit"`, so both the unit label and its plural form follow
 * the locale rather than a hand-rolled English string.
 *
 * `unitDisplay` selects the compact (`"narrow"`) or spelled-out (`"long"`) rendering; unit
 * selection is shared so the two cannot drift apart.
 */
export function formatDuration(
  locale: string,
  seconds: number,
  unitDisplay: Intl.NumberFormatOptions["unitDisplay"],
): string {
  const { value, unit } = pickDurationUnit(seconds);
  return formatterFor(locale, unit, unitDisplay).format(value);
}

function formatterFor(
  locale: string,
  unit: DurationUnit,
  unitDisplay: Intl.NumberFormatOptions["unitDisplay"],
): Intl.NumberFormat {
  const key = `${locale}|${unitDisplay}|${unit}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay });
    formatters.set(key, formatter);
  }
  return formatter;
}
