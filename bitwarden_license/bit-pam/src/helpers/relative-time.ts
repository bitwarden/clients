/**
 * Format an instant as a localized relative phrase, e.g. "5 min. ago" or
 * "in 2 hr.", by walking from seconds up to years and emitting the first unit
 * the delta fits within.
 *
 * The {@link Intl.RelativeTimeFormat} is passed in (not constructed here) so the
 * caller controls locale and can cache the formatter across many rows. Both
 * times are epoch milliseconds; a non-finite result returns the empty string.
 */
export function formatRelativeTime(
  epochMs: number,
  nowMs: number,
  formatter: Intl.RelativeTimeFormat,
): string {
  let duration = (epochMs - nowMs) / 1000;
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return "";
}

/**
 * Compute a coarse, i18n-key-friendly elapsed-time bucket for an ISO timestamp
 * relative to `now`. Returning a `{ key, value }` pair (rather than formatted
 * text) keeps localization in the template. Negative or unparseable inputs
 * collapse to the "just now" bucket.
 */
export function elapsedKey(submittedAt: string, now: Date): { key: string; value: number } {
  const submittedMs = Date.parse(submittedAt);
  if (Number.isNaN(submittedMs)) {
    return { key: "pamInboxElapsedJustNow", value: 0 };
  }
  const diffMs = Math.max(0, now.getTime() - submittedMs);
  const minutes = Math.floor(diffMs / 60_000);
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
  const days = Math.floor(hours / 24);
  return { key: "pamInboxElapsedDays", value: days };
}
