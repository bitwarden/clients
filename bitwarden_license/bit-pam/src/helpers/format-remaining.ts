/**
 * Format a millisecond duration as a short low-noise countdown:
 *   - "2h 5m" for 2 hours 5 minutes remaining
 *   - "2h" when minutes round to zero
 *   - "47m" when under one hour
 *   - "15s" when under one minute
 *   - "0s" when the duration is non-positive or non-finite
 *
 * Rounding is `Math.ceil` so the countdown never undersells remaining time.
 * Callers holding `(notAfter, now)` can pass `notAfter.getTime() - now.getTime()`.
 */
export function formatRemaining(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "0s";
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
