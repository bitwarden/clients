/**
 * Shortens a hex fingerprint (this installation's own, or a paired agent's) to its first 6
 * characters (upper-cased) for compact display in chips, list rows, and activity log entries.
 * Shared by the Agent Access shell and both of its routed tabs (Paired agents, Activity).
 */
export function shortenFingerprint(fingerprint: string | null | undefined): string {
  return fingerprint ? `${fingerprint.slice(0, 6).toUpperCase()}…` : "";
}
