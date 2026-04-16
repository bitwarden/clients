/**
 * Returns the number of calendar days between `date` and `now` in the user's local timezone.
 * Uses `Math.round` to handle DST transitions, where consecutive calendar days can be
 * 23h or 25h apart instead of exactly 24h.
 */
function calendarDaysAgo(date: Date, now: Date): number {
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((nowMidnight.getTime() - dateMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the i18n key describing how recently a device was active,
 * or null if no activity date is available.
 *
 * Buckets are based on calendar days in the user's local timezone, not elapsed hours.
 *
 * @param lastActivityDate - The device's last activity date, or null if unknown.
 * @param now - The current date (injectable for testing). Defaults to `new Date()`.
 */
export function getDeviceLastActivityDateI18nKey(
  lastActivityDate: Date | null,
  now = new Date(),
): string | null {
  if (!lastActivityDate) {
    return null;
  }

  const daysAgo = calendarDaysAgo(lastActivityDate, now);

  if (daysAgo <= 0) {
    return "recentlyActiveToday";
  }
  if (daysAgo < 7) {
    return "recentlyActivePast7Days";
  }
  if (daysAgo < 14) {
    return "recentlyActivePast14Days";
  }
  if (daysAgo < 30) {
    return "recentlyActivePast30Days";
  }

  return "recentlyActiveOver30Days";
}
