/**
 * The state of the vault-health scan driven by the Health tab.
 *
 * Uses a const object rather than a TypeScript enum per ADR-0025.
 */
export const VaultHealthScanState = Object.freeze({
  /** The scan is running; the Scan Progress view is shown. */
  Scanning: "scanning",
  /** The scan completed; the Health Overview is shown. */
  Results: "results",
  /** The scan did not complete; the scan-failure state is shown. */
  Failure: "failure",
} as const);

export type VaultHealthScanState = (typeof VaultHealthScanState)[keyof typeof VaultHealthScanState];
