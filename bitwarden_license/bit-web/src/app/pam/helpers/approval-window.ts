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
  if (seconds < 3600) {
    return { key: "pamInboxDurationMinutes", value: Math.max(1, Math.round(seconds / 60)) };
  }
  const hours = seconds / 3600;
  if (hours === 1) {
    return { key: "pamInboxDuration1Hour", value: null };
  }
  return {
    key: "pamInboxDurationHours",
    value: Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10,
  };
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

const WINDOW_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

/** The exact window, for the tooltip. */
export function exactWindow(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
): string {
  return `${WINDOW_FORMAT.format(new Date(request.leaseNotBefore))} – ${WINDOW_FORMAT.format(new Date(request.leaseNotAfter))}`;
}
