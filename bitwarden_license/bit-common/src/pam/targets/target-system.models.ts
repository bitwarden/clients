/**
 * Plain views of the SDK's target system types. The name is organization configuration that the
 * server supplied, so it is run through `sanitizeUntrusted`. Dates are the SDK's UTC strings,
 * unchanged.
 *
 * The sealed fields (kind, password policy, session termination) are never copied into a view,
 * only whether the server's blob unsealed. They are what `update` makes the operator resend.
 */

export type TargetSystemMethodName = "automatic" | "manual" | "unknown";
export type TargetSystemStatusName = "active" | "disabled" | "pending_seal" | "unknown";

export interface TargetSystemSummary {
  id: string;
  organizationId: string;
  name: string;
  method: TargetSystemMethodName;
  status: TargetSystemStatusName;
  /** False when the blob is not sealed yet, fails to unseal, or disagrees with the row. */
  sealed: boolean;
  creationDate: string;
  revisionDate: string;
}
