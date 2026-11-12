import type {
  ApprovalDecisionResult,
  ApprovalRow,
  ManagedLeaseRow,
} from "@bitwarden/bit-common/pam/approvals";
import type { PamNames } from "@bitwarden/bit-common/pam/shared";

import { isoDate, PamObject, PamResponse } from "../shared";

/**
 * One request in the inbox or history. Ids, states and ISO timestamps only: never the requester's
 * reason, a decision comment, or the requester's name or email. Names appear only with `--names`.
 */
export class ApprovalRowResponse extends PamResponse {
  id: string;
  cipherId: string;
  cipherName?: string;
  collectionId: string;
  collectionName?: string;
  organizationId?: string;
  organizationName?: string;
  requesterId: string;
  ruleId?: string;
  status: string;
  leaseNotBefore?: string;
  leaseNotAfter?: string;
  submittedAt?: string;
  resolvedAt?: string;
  extensionOfLeaseId?: string;
  awaitingActivation: boolean;
  verdict?: string;
  producedLeaseId?: string;
  producedLeaseStatus?: string;
  producedLeaseNotAfter?: string;

  constructor(row: ApprovalRow, names?: PamNames) {
    super(PamObject.Approval);
    this.id = row.id;
    this.cipherId = row.cipherId;
    this.collectionId = row.collectionId;
    this.organizationId = row.organizationId;
    if (names != null) {
      this.cipherName = names.cipher(row.cipherId);
      this.collectionName = names.collection(row.collectionId);
      if (row.organizationId != null) {
        this.organizationName = names.organization(row.organizationId);
      }
    }
    this.requesterId = row.requesterId;
    this.ruleId = row.ruleId;
    this.status = row.status;
    this.leaseNotBefore = isoDate(row.leaseNotBefore);
    this.leaseNotAfter = isoDate(row.leaseNotAfter);
    this.submittedAt = isoDate(row.submittedAt);
    this.resolvedAt = isoDate(row.resolvedAt);
    this.extensionOfLeaseId = row.extensionOfLeaseId;
    this.awaitingActivation = row.awaitingActivation;
    this.verdict = row.verdict;
    this.producedLeaseId = row.producedLeaseId;
    this.producedLeaseStatus = row.producedLeaseStatus;
    this.producedLeaseNotAfter = isoDate(row.producedLeaseNotAfter);
  }
}

/** The partial view of a decision: id, status, resolved time and verdict, nothing else. */
export class ApprovalDecisionResponse extends PamResponse {
  id: string;
  status: string;
  resolvedAt?: string;
  verdict: string;

  constructor(result: ApprovalDecisionResult) {
    super(PamObject.Approval);
    this.id = result.id;
    this.status = result.status;
    this.resolvedAt = isoDate(result.resolvedAt);
    this.verdict = result.verdict;
  }
}

/** A lease the approver's decisions produced, derived from history rows. */
export class ManagedLeaseResponse extends PamResponse {
  leaseId: string;
  requestId: string;
  cipherId: string;
  cipherName?: string;
  collectionId: string;
  collectionName?: string;
  organizationId?: string;
  requesterId: string;
  leaseStatus: string;
  notAfter?: string;
  liveness: string;

  constructor(row: ManagedLeaseRow, names?: PamNames) {
    super(PamObject.Lease);
    this.leaseId = row.leaseId;
    this.requestId = row.requestId;
    this.cipherId = row.cipherId;
    this.collectionId = row.collectionId;
    if (names != null) {
      this.cipherName = names.cipher(row.cipherId);
      this.collectionName = names.collection(row.collectionId);
    }
    this.organizationId = row.organizationId;
    this.requesterId = row.requesterId;
    this.leaseStatus = row.leaseStatus;
    this.notAfter = isoDate(row.notAfter);
    this.liveness = row.liveness;
  }
}

/** The result of a withdrawal or a lease revocation, which return no view. */
export class ApprovalActionResponse extends PamResponse {
  constructor(
    readonly action: "withdrawn" | "lease-revoked" | "already-resolved" | "window-ended",
    readonly id: string,
    readonly message: string,
  ) {
    super(PamObject.Approval);
  }
}
