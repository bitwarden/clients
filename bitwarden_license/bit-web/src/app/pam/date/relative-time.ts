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
