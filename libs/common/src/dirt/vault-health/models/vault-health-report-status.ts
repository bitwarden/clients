/**
 * Where a user's vault health scan is: not started, running, done, or failed.
 * Lets the Health tab tell a scan still running from one that failed.
 */
export const VaultHealthReportStatus = Object.freeze({
  Idle: "idle",
  Loading: "loading",
  Success: "success",
  Error: "error",
} as const);

export type VaultHealthReportStatus =
  (typeof VaultHealthReportStatus)[keyof typeof VaultHealthReportStatus];
