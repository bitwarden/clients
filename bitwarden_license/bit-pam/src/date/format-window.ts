import { formatCalendarDate, formatClockTime } from "./format-date";

/** Resolves an i18n key against its placeholders; the i18n service's `t`, minus the service. */
type Translate = (key: string, ...args: string[]) => string;

export type WindowParts = {
  sharedDay: string;
  start: WindowEndpoint;
  end: WindowEndpoint;
};

export type WindowEndpoint = { day: string; time: string };

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

const MS_PER_DAY = 86_400_000;

function dayOffset(epochMs: number, nowMs: number): number {
  return Math.round((startOfDay(epochMs) - startOfDay(nowMs)) / MS_PER_DAY);
}

function startOfDay(epochMs: number): number {
  const date = new Date(epochMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function formatWindowDay(locale: string, epochMs: number, nowMs: number): string {
  const offset = dayOffset(epochMs, nowMs);
  if (offset === 0) {
    return "";
  }
  if (offset === 1 || offset === -1) {
    let relative = relativeFormats.get(locale);
    if (!relative) {
      relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      relativeFormats.set(locale, relative);
    }
    return capitalize(locale, relative.format(offset, "day"));
  }
  return formatCalendarDate(locale, epochMs);
}

function capitalize(locale: string, value: string): string {
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

/** Exported for tests. */
export function windowEndpoint(locale: string, epochMs: number, nowMs: number): WindowEndpoint {
  return { day: formatWindowDay(locale, epochMs, nowMs), time: formatClockTime(locale, epochMs) };
}

/** Exported for tests. */
export function windowParts(
  locale: string,
  startMs: number,
  endMs: number,
  nowMs: number,
): WindowParts {
  const sameDay = dayOffset(startMs, nowMs) === dayOffset(endMs, nowMs);
  const start = windowEndpoint(locale, startMs, nowMs);
  const end = windowEndpoint(locale, endMs, nowMs);
  if (!sameDay) {
    return { sharedDay: "", start, end };
  }
  return {
    sharedDay: start.day,
    start: { day: "", time: start.time },
    end: { day: "", time: end.time },
  };
}

/** Exported for tests. */
export function joinEndpoint(translate: Translate, endpoint: WindowEndpoint): string {
  return endpoint.day ? translate("pamWindowOnDay", endpoint.day, endpoint.time) : endpoint.time;
}

/**
 * The requested window in words. A window that has already opened reads as its end alone
 * ("Until 8:07 PM"); one still to open reads as its range, with a shared day lifted out front
 * ("Tomorrow, 9 AM to 1 PM"). Takes `nowMs` so a live caller can re-format as the day turns over.
 */
export function formatRequestedWindow(
  translate: Translate,
  locale: string,
  startMs: number,
  endMs: number,
  nowMs: number,
): string {
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "";
  }
  if (startMs <= nowMs) {
    return translate(
      "pamWindowOpenUntil",
      joinEndpoint(translate, windowEndpoint(locale, endMs, nowMs)),
    );
  }
  const parts = windowParts(locale, startMs, endMs, nowMs);
  const range = translate(
    "pamWindowRange",
    joinEndpoint(translate, parts.start),
    joinEndpoint(translate, parts.end),
  );
  return parts.sharedDay ? translate("pamWindowOnDay", parts.sharedDay, range) : range;
}
