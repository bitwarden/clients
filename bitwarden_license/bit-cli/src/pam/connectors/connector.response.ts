import type {
  ConnectorDetailView,
  ConnectorJobView,
  ConnectorRegistration,
  ConnectorView,
} from "@bitwarden/bit-common/pam/connectors";

import { isoDate, PamObject, PamResponse } from "../shared";

/** `pam-connector`. Names are server text already sanitized by the service. */
export class ConnectorResponse extends PamResponse {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  isConnected: boolean;
  lastHeartbeatAt?: string;
  assignedTargetSystemIds: string[];
  creationDate?: string;
  revisionDate?: string;

  constructor(view: ConnectorView, object: `pam-${string}` = PamObject.Connector) {
    super(object);
    this.id = view.id;
    this.organizationId = view.organizationId;
    this.name = view.name;
    this.status = view.status;
    this.isConnected = view.isConnected;
    this.lastHeartbeatAt = isoDate(view.lastHeartbeatAt);
    this.assignedTargetSystemIds = view.assignedTargetSystemIds;
    this.creationDate = isoDate(view.creationDate);
    this.revisionDate = isoDate(view.revisionDate);
  }
}

/** One recent rotation job of a connector. `latestFailureReason` is untrusted, sanitized text. */
export class ConnectorJobResponse {
  id: string;
  rotationConfigId: string;
  source: string;
  status: string;
  claimedAt?: string;
  createdAt?: string;
  nextClaimableAt?: string;
  expiresAt?: string;
  attemptCount: number;
  latestAttemptStatus?: string;
  latestFailureCode?: string;
  latestFailureReason?: string;

  constructor(job: ConnectorJobView) {
    this.id = job.id;
    this.rotationConfigId = job.rotationConfigId;
    this.source = job.source;
    this.status = job.status;
    this.claimedAt = isoDate(job.claimedAt);
    this.createdAt = isoDate(job.createdAt);
    this.nextClaimableAt = isoDate(job.nextClaimableAt);
    this.expiresAt = isoDate(job.expiresAt);
    this.attemptCount = job.attemptCount;
    this.latestAttemptStatus = job.latestAttemptStatus;
    this.latestFailureCode = job.latestFailureCode;
    this.latestFailureReason = job.latestFailureReason;
  }
}

export class ConnectorDetailResponse extends ConnectorResponse {
  jobs: ConnectorJobResponse[];

  constructor(view: ConnectorDetailView) {
    super(view);
    this.jobs = view.jobs.map((j) => new ConnectorJobResponse(j));
  }
}

/**
 * `pam-connector-registration`. Carries `token` only when it was not written to a file. The token
 * is shown once and cannot be recovered, so this object is never stored or logged.
 */
export class ConnectorRegistrationResponse extends PamResponse {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  creationDate?: string;
  token?: string;
  tokenFile?: string;

  constructor(registration: ConnectorRegistration, delivery: { tokenFile?: string }) {
    super("pam-connector-registration");
    this.id = registration.id;
    this.organizationId = registration.organizationId;
    this.name = registration.name;
    this.status = registration.status;
    this.creationDate = isoDate(registration.creationDate);
    if (delivery.tokenFile == null) {
      this.token = registration.token;
    } else {
      this.tokenFile = delivery.tokenFile;
    }
  }
}

/** `pam-connector-action`: the outcome of enable, disable, delete, assign or unassign. */
export class ConnectorActionResponse extends PamResponse {
  constructor(
    readonly action: "enabled" | "disabled" | "deleted" | "assigned" | "unassigned",
    readonly id: string,
    readonly organizationId: string,
    readonly targetSystemId?: string,
  ) {
    super("pam-connector-action");
  }
}
