import { formatUnit } from "./format-duration";

const lists = new Map<string, Intl.ListFormat>();
const longLists = new Map<string, Intl.ListFormat>();

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
 * The time left, spelled out, such as "4 minutes", "1 hour, 59 minutes" or "1 day, 7 hours". Under
 * a day it shows hours and minutes; from a day up it shows days and hours, dropping minutes, so a
 * small change at that scale (such as a 30-minute extension) may leave the text unchanged. Seconds
 * and minutes round up so a countdown never undersells; hours within a day-level reading round
 * down so it never promises time that is not left.
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
    const minutes = totalMinutes - totalHours * 60;
    const parts = [formatUnit(locale, totalHours, "hour", "long")];
    if (minutes > 0) {
      parts.push(formatUnit(locale, minutes, "minute", "long"));
    }
    return longListFor(locale).format(parts);
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  const parts = [formatUnit(locale, days, "day", "long")];
  if (hours > 0) {
    parts.push(formatUnit(locale, hours, "hour", "long"));
  }
  return longListFor(locale).format(parts);
}

function longListFor(locale: string): Intl.ListFormat {
  let list = longLists.get(locale);
  if (!list) {
    list = new Intl.ListFormat(locale, { type: "unit", style: "long" });
    longLists.set(locale, list);
  }
  return list;
}

function listFor(locale: string): Intl.ListFormat {
  let list = lists.get(locale);
  if (!list) {
    list = new Intl.ListFormat(locale, { type: "unit", style: "narrow" });
    lists.set(locale, list);
  }
  return list;
}
