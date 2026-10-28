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
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((startDay - today) / 86_400_000);
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
