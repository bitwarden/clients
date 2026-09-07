/** An i18n key plus its numeric argument, leaving the formatting to the template. */
export type ElapsedLabel = { key: string; value: number };

/**
 * How long ago something happened, as an i18n key and a count — "Just now", "10m ago", "5h
 * ago", "2d ago".
 *
 * Coarser than {@link formatRemaining} on purpose: rounds DOWN to the largest whole unit and
 * never ticks, since an approver needs to spot the oldest request, not a second-accurate age.
 * An unparseable timestamp reads as "Just now" rather than throwing.
 */
export function elapsedLabel(since: string, now: Date): ElapsedLabel {
  const sinceMs = Date.parse(since);
  if (Number.isNaN(sinceMs)) {
    return { key: "pamInboxElapsedJustNow", value: 0 };
  }
  const minutes = Math.floor(Math.max(0, now.getTime() - sinceMs) / 60_000);
  if (minutes < 1) {
    return { key: "pamInboxElapsedJustNow", value: 0 };
  }
  if (minutes < 60) {
    return { key: "pamInboxElapsedMinutes", value: minutes };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { key: "pamInboxElapsedHours", value: hours };
  }
  return { key: "pamInboxElapsedDays", value: Math.floor(hours / 24) };
}
