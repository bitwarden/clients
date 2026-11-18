import type { AccessRequestView } from "../abstractions/access-lease";
import { formatTimestamp } from "../date/format-date";
import { formatCompoundDuration } from "../date/format-duration";

import { requestedWindowSeconds } from "./requested-window";

/** An i18n `{ key, value }` pair, so localization stays in the template. */
export type LabelValue = { key: string; value: number | null };

export function reasonText(request: Pick<AccessRequestView, "reason">): string | null {
  return request.reason?.trim() || null;
}

/**
 * The requested duration in words, e.g. "2 days, 2 hours". The same spelling the My requests
 * table uses through `durationCompound`, so the two tabs cannot describe one window differently.
 */
export function durationText(
  window: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
  locale: string,
): string {
  return formatCompoundDuration(locale, requestedWindowSeconds(window), "long");
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

/** The exact window, for the tooltip, in the user's chosen locale rather than the browser's. */
export function exactWindow(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
  locale: string,
): string {
  return `${formatTimestamp(locale, Date.parse(request.leaseNotBefore))} – ${formatTimestamp(locale, Date.parse(request.leaseNotAfter))}`;
}

/** Whole local calendar days from `from` to `to`, ignoring the time of day. */
function calendarDaysBetween(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((toDay - fromDay) / 86_400_000);
}
