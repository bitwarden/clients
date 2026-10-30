import type { AccessRequestView } from "../abstractions/access-lease";

import { requestedWindowSeconds } from "./requested-window";

/** An i18n `{ key, value }` pair, so localization stays in the template. */
export type LabelValue = { key: string; value: number | null };

export function reasonText(request: Pick<AccessRequestView, "reason">): string | null {
  return request.reason?.trim() || null;
}

/** A coarse label for the requested duration, e.g. "4 hours" or "30 min". */
export function durationLabel(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
): LabelValue {
  const seconds = requestedWindowSeconds(request);
  // Rounded before picking the key, so a window just either side of an hour reads "1 hour".
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return { key: "pamInboxDurationMinutes", value: minutes };
  }
  const hours = Math.round(seconds / 360) / 10;
  if (hours === 1) {
    return { key: "pamInboxDuration1Hour", value: null };
  }
  return { key: "pamInboxDurationHours", value: hours };
}

/**
 * When the window opens, e.g. "tomorrow". The server always resolves the start, so "starting now"
 * means it has passed rather than that it is missing.
 */
export function relativeStart(
  request: Pick<AccessRequestView, "leaseNotBefore">,
  now: Date,
): LabelValue {
  const start = new Date(Date.parse(request.leaseNotBefore));
  if (start.getTime() <= now.getTime()) {
    return { key: "pamInboxStartAsap", value: null };
  }
  const diffDays = calendarDaysBetween(now, start);
  if (diffDays <= 0) {
    return { key: "pamInboxStartToday", value: null };
  }
  if (diffDays === 1) {
    return { key: "pamInboxStartTomorrow", value: null };
  }
  return { key: "pamInboxStartInDays", value: diffDays };
}

const windowFormats = new Map<string, Intl.DateTimeFormat>();

/** The exact window, for the tooltip, in the user's chosen locale rather than the browser's. */
export function exactWindow(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
  locale: string,
): string {
  const format = windowFormatFor(locale);
  return `${format.format(new Date(request.leaseNotBefore))} – ${format.format(new Date(request.leaseNotAfter))}`;
}

function windowFormatFor(locale: string): Intl.DateTimeFormat {
  let format = windowFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
    windowFormats.set(locale, format);
  }
  return format;
}

/** An i18n key with already-formatted string placeholders, such as times and dates. */
export type FormattedLabel = { key: string; values: string[] };

const TIME_ON_THE_HOUR_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/**
 * The requested window in words, e.g. "Tomorrow, 9 AM to 1 PM" or "Sep 30, 4:12 PM to Oct 3,
 * 4:12 PM". A window that has already opened reads as its end alone, e.g. "Until 8:07 PM".
 */
export function windowRange(
  window: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
  now: Date,
): FormattedLabel {
  const start = new Date(Date.parse(window.leaseNotBefore));
  const end = new Date(Date.parse(window.leaseNotAfter));

  if (start.getTime() <= now.getTime()) {
    const until = calendarDaysBetween(now, end) === 0 ? formatTime(end) : formatDateTime(end);
    return { key: "pamWindowUntil", values: [until] };
  }

  if (calendarDaysBetween(start, end) !== 0) {
    return { key: "pamWindowRange", values: [formatDateTime(start), formatDateTime(end)] };
  }

  const times = [formatTime(start), formatTime(end)];
  switch (calendarDaysBetween(now, start)) {
    case 0:
      return { key: "pamWindowTodayRange", values: times };
    case 1:
      return { key: "pamWindowTomorrowRange", values: times };
    default:
      return { key: "pamWindowSameDayRange", values: [DATE_FORMAT.format(start), ...times] };
  }
}

/** Whole local calendar days from `from` to `to`, ignoring the time of day. */
function calendarDaysBetween(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((toDay - fromDay) / 86_400_000);
}

/** "9 AM" on the hour, "8:07 PM" otherwise. */
function formatTime(date: Date): string {
  return (date.getMinutes() === 0 ? TIME_ON_THE_HOUR_FORMAT : TIME_FORMAT).format(date);
}

function formatDateTime(date: Date): string {
  return `${DATE_FORMAT.format(date)}, ${formatTime(date)}`;
}
