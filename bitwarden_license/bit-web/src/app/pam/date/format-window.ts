export type WindowParts = {
  sharedDay: string;
  start: WindowEndpoint;
  end: WindowEndpoint;
};

export type WindowEndpoint = { day: string; time: string };

class DateTimeFormatCache {
  private readonly formats = new Map<string, Intl.DateTimeFormat>();

  get(key: string, locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    let format = this.formats.get(key);
    if (!format) {
      format = new Intl.DateTimeFormat(locale, options);
      this.formats.set(key, format);
    }
    return format;
  }
}

const clockFormats = new DateTimeFormatCache();
const dayFormats = new DateTimeFormatCache();
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

export function formatClockTime(locale: string, epochMs: number): string {
  const onTheHour = new Date(epochMs).getMinutes() === 0;
  return clockFormats
    .get(`${locale}|${onTheHour}`, locale, {
      hour: "numeric",
      hour12: true,
      ...(onTheHour ? {} : { minute: "2-digit" }),
    })
    .format(epochMs);
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
  return dayFormats.get(locale, locale, { month: "short", day: "numeric" }).format(epochMs);
}

function capitalize(locale: string, value: string): string {
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

export function windowEndpoint(locale: string, epochMs: number, nowMs: number): WindowEndpoint {
  return { day: formatWindowDay(locale, epochMs, nowMs), time: formatClockTime(locale, epochMs) };
}

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

export function joinEndpoint(
  translate: (key: string, ...args: string[]) => string,
  endpoint: WindowEndpoint,
): string {
  return endpoint.day ? translate("pamWindowOnDay", endpoint.day, endpoint.time) : endpoint.time;
}
