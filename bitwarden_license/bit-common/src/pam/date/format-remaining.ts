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

/**
 * The same countdown reduced to its largest unit for a compact badge: "2h", "47m", and "<1m"
 * for anything under a minute, including non-positive and non-finite input.
 */
export function formatRemainingCompact(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "<1m";
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) {
    return "<1m";
  }
  const totalMinutes = Math.ceil(totalSeconds / 60);
  return totalMinutes < 60 ? `${totalMinutes}m` : `${Math.floor(totalMinutes / 60)}h`;
}
