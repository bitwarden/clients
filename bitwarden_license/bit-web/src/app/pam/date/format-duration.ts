import { DurationUnit, pickDurationUnit } from "..";

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * A duration in its largest whole unit, localized through `Intl.NumberFormat`'s `style: "unit"`.
 */
export function formatDuration(
  locale: string,
  seconds: number,
  unitDisplay: Intl.NumberFormatOptions["unitDisplay"],
): string {
  const { value, unit } = pickDurationUnit(seconds);
  return formatterFor(locale, unit, unitDisplay).format(value);
}

const COMPOUND_UNITS: { seconds: number; unit: DurationUnit }[] = [
  { seconds: 86400, unit: "day" },
  { seconds: 3600, unit: "hour" },
  { seconds: 60, unit: "minute" },
];

/** A duration as its whole days, hours and minutes, e.g. `2 days, 22 hours`. */
export function formatCompoundDuration(
  locale: string,
  seconds: number,
  unitDisplay: Intl.NumberFormatOptions["unitDisplay"],
): string {
  let rest = Math.round(seconds / 60) * 60;
  const parts: string[] = [];
  for (const { seconds: size, unit } of COMPOUND_UNITS) {
    const value = Math.floor(rest / size);
    rest -= value * size;
    if (value > 0) {
      parts.push(formatterFor(locale, unit, unitDisplay).format(value));
    }
  }
  return parts.length === 0
    ? formatDuration(locale, seconds, unitDisplay)
    : new Intl.ListFormat(locale, { type: "unit", style: "long" }).format(parts);
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
