/**
 * Format a millisecond duration as a short low-noise countdown: "2h 5m", "2h" when minutes
 * round to zero, "47m" under one hour, "15s" under one minute, "0s" when non-positive or
 * non-finite.
 *
 * Rounds with `Math.ceil` so the countdown never undersells remaining time.
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
