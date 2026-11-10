type Formatter = (epochMs: number) => string;

/** Gregorian with Latin digits, as `DatePipe` showed, whatever the locale's default. */
const GREGORIAN: Intl.DateTimeFormatOptions = { calendar: "gregory", numberingSystem: "latn" };
const DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

const FORMATS = {
  date: { ...GREGORIAN, ...DATE },
  time: { ...GREGORIAN, ...TIME },
  clock: { ...GREGORIAN, ...TIME, hour12: true },
  clockOnTheHour: { ...GREGORIAN, hour: "numeric", hour12: true },
  minute: { ...GREGORIAN, ...DATE, ...TIME },
  second: { ...GREGORIAN, ...DATE, ...TIME, second: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const formatters = new Map<string, Formatter>();

/** "Nov 4, 2026": the month abbreviated, the year included, never all digits. */
export function formatCalendarDate(locale: string, epochMs: number): string {
  return format("date", locale, epochMs);
}

/**
 * "Nov 4, 2026, 3:45 PM": {@link formatCalendarDate} and the time, on the locale's own clock.
 * `"second"` adds the seconds, for an audit trail.
 */
export function formatTimestamp(
  locale: string,
  epochMs: number,
  precision: "minute" | "second" = "minute",
): string {
  return format(precision, locale, epochMs);
}

/** "3:45 PM": the time part of {@link formatTimestamp}, for a point on a day already named. */
export function formatTimeOfDay(locale: string, epochMs: number): string {
  return format("time", locale, epochMs);
}

/** "9 AM" or "5:11 PM": the requested window's clock, 12-hour in every locale (PAM-309). */
export function formatClockTime(locale: string, epochMs: number): string {
  const onTheHour = new Date(epochMs).getMinutes() === 0;
  return format(onTheHour ? "clockOnTheHour" : "clock", locale, epochMs);
}

/** Empty for an unparseable instant, rather than the `RangeError` Intl throws. */
function format(name: keyof typeof FORMATS, locale: string, epochMs: number): string {
  if (Number.isNaN(epochMs)) {
    return "";
  }
  const key = `${name}|${locale}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = createFormatter(locale, FORMATS[name]);
    formatters.set(key, formatter);
  }
  return formatter(epochMs);
}

/** English copy abbreviates September as "Sept", where en-US locale data has "Sep". */
function createFormatter(locale: string, options: Intl.DateTimeFormatOptions): Formatter {
  const intl = new Intl.DateTimeFormat(locale, options);
  if (options.month == null || !intl.resolvedOptions().locale.startsWith("en")) {
    return (epochMs) => intl.format(epochMs);
  }
  return (epochMs) => intl.format(epochMs).replace(/\bSep\b/, "Sept");
}
