/**
 * Plain views of the SDK's access connector types. Text the server supplied (the connector name
 * and a job's failure reason) is already run through `sanitizeUntrusted`. Dates are the SDK's
 * UTC strings, unchanged.
 */

export type ConnectorStatus = "enabled" | "disabled" | "unknown";

export interface ConnectorView {
  id: string;
  organizationId: string;
  name: string;
  status: ConnectorStatus;
  isConnected: boolean;
  lastHeartbeatAt?: string;
  assignedTargetSystemIds: string[];
  creationDate: string;
  revisionDate: string;
}

/** One rotation job a connector worked. The newest attempt stands for the job. */
export interface ConnectorJobView {
  id: string;
  rotationConfigId: string;
  source: string;
  status: string;
  claimedAt?: string;
  createdAt: string;
  nextClaimableAt?: string;
  expiresAt?: string;
  attemptCount: number;
  latestAttemptStatus?: string;
  latestFailureCode?: string;
  /** Untrusted text the connector reported. Sanitized and capped. Never log it. */
  latestFailureReason?: string;
}

export interface ConnectorDetailView extends ConnectorView {
  jobs: ConnectorJobView[];
}

/**
 * The result of registering a connector. `token` is returned once and the server keeps only a
 * hash of it: never persist it, never log it.
 */
export interface ConnectorRegistration {
  id: string;
  organizationId: string;
  name: string;
  status: ConnectorStatus;
  creationDate: string;
  token: string;
}
