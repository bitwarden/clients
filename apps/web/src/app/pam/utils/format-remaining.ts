/**
 * Format the time remaining until `notAfter` for a lease countdown badge.
 *
 * Returns short, low-noise strings such as:
 *   - "2h 5m" for 2 hours 5 minutes remaining
 *   - "47m" for 47 minutes remaining (no seconds shown above 1 minute)
 *   - "15s" for under a minute
 *   - "0s" once the lease has expired (callers may swap for an expired badge)
 *
 * This helper is intentionally pure so it can be shared by the active leases
 * view and the cipher lease badge without coupling either to the other's
 * component code.
 *
 * @param notAfter the lease expiry instant (`LeaseResponse.notAfter`); accepts
 *                 ISO 8601 strings or `Date` instances.
 * @param now      the reference instant — usually `new Date()` but injectable
 *                 to make the helper trivially testable.
 */
export function formatRemaining(notAfter: Date | string, now: Date): string {
  const expiry = typeof notAfter === "string" ? new Date(notAfter) : notAfter;
  const remainingMs = expiry.getTime() - now.getTime();

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "0s";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    // Drop minutes if they round to zero — "2h" reads cleaner than "2h 0m".
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}
