/**
 * An instant as a relative phrase in the first unit its distance from `nowMs` fits. The formatter
 * is passed in so the caller picks the locale and can reuse it across rows.
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
