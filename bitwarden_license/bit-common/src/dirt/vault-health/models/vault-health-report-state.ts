import { VaultHealthReportStatus } from "./vault-health-report-status";
import { VaultHealthReportView } from "./view/vault-health-report.view";

/**
 * A user's scan status plus their last report. The report stays put through
 * `loading` and `error` so it never flickers to null during a rescan.
 */
export type VaultHealthReportState = {
  status: VaultHealthReportStatus;
  report: VaultHealthReportView | null;
};

/**
 * The starting state, before any scan has run. One frozen instance so callers
 * can compare it by reference.
 */
export const VAULT_HEALTH_REPORT_IDLE: VaultHealthReportState = Object.freeze({
  status: VaultHealthReportStatus.Idle,
  report: null,
});
