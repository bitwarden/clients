import type { AccessRequestView } from "../abstractions/access-lease";

import { requestedWindowSeconds } from "./requested-window";

/** An i18n `{ key, value }` pair, leaving localization to the template. */
export type LabelValue = { key: string; value: number | null };

/** The request's reason, trimmed, or null when blank. */
export function reasonText(request: Pick<AccessRequestView, "reason">): string | null {
  return request.reason?.trim() || null;
}

/**
 * A coarse i18n label for the requested lease duration ("1 hour", "4 hours", "30 min"), derived
 * from the requested window.
 */
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
 * A relative phrase for when the window opens ("starting now", "today", "tomorrow", "in N days").
 * Unlike the poc (whose `leaseNotBefore` could be absent for an open-ended/on-demand request),
 * this repo's `AccessRequestView` always resolves the window at submit — so "starting now" covers
 * a window whose start has already passed (an immediate/on-demand request), not a missing bound.
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

/** Shared formatter for the exact-window tooltip — built once, not per call. */
const WINDOW_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

/** A fully-formatted "from – to" window for the tooltip. */
export function exactWindow(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
): string {
  return `${WINDOW_FORMAT.format(new Date(request.leaseNotBefore))} – ${WINDOW_FORMAT.format(new Date(request.leaseNotAfter))}`;
}
