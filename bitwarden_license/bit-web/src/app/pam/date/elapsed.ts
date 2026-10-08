/** An i18n key plus its numeric argument, for the template to format. */
export type ElapsedLabel = { key: string; value: number };

/**
 * How long ago something happened, e.g. "10m ago". Rounds down to the largest whole unit and never
 * ticks, since an approver needs to spot the oldest request, not a second-accurate age.
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
