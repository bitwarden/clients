import { formatUnit } from "./format-duration";

const lists = new Map<string, Intl.ListFormat>();

/**
 * A short countdown such as "2h 5m" or "47m", localized through `Intl`. Rounds up, so it never
 * undersells the time left.
 */
export function formatRemaining(locale: string, remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return formatUnit(locale, 0, "second", "narrow");
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) {
    return formatUnit(locale, totalSeconds, "second", "narrow");
  }
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) {
    return formatUnit(locale, totalMinutes, "minute", "narrow");
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  const parts = [formatUnit(locale, hours, "hour", "narrow")];
  if (minutes > 0) {
    parts.push(formatUnit(locale, minutes, "minute", "narrow"));
  }
  return listFor(locale).format(parts);
}

/**
 * The time left in its largest whole unit, spelled out, such as "4 minutes" or "20 days". Seconds
 * and minutes round up so a countdown never undersells; hours and days round down so a larger
 * unit never promises time that is not left.
 */
export function formatRemainingLong(locale: string, remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return formatUnit(locale, 0, "second", "long");
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) {
    return formatUnit(locale, totalSeconds, "second", "long");
  }
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) {
    return formatUnit(locale, totalMinutes, "minute", "long");
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return formatUnit(locale, totalHours, "hour", "long");
  }
  return formatUnit(locale, Math.floor(totalHours / 24), "day", "long");
}

function listFor(locale: string): Intl.ListFormat {
  let list = lists.get(locale);
  if (!list) {
    list = new Intl.ListFormat(locale, { type: "unit", style: "narrow" });
    lists.set(locale, list);
  }
  return list;
}
