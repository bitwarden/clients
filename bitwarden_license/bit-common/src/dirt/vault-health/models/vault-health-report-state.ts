import { VaultHealthReportView } from "./view/vault-health-report.view";

/**
 * Where report generation is for a given user.
 *
 * Published by VaultHealthReportService so every Health page can tell a scan
 * that is still running from one that failed, rather than reading both as a
 * missing report.
 */
export type VaultHealthReportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; report: VaultHealthReportView }
  | { status: "error" };

/**
 * The state before anything has been generated for a user.
 *
 * Exported as a single frozen instance so callers can rely on reference
 * equality, which is what lets `distinctUntilChanged` collapse repeats.
 */
export const VAULT_HEALTH_REPORT_IDLE: VaultHealthReportState = Object.freeze({ status: "idle" });
