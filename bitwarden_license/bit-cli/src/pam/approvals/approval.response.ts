import type {
  ApprovalDecisionResult,
  ApprovalRow,
  ManagedLeaseRow,
} from "@bitwarden/bit-common/pam/approvals";
import { sanitizeUntrusted, type PamNames } from "@bitwarden/bit-common/pam/shared";

import { isoDate, PamObject, PamResponse } from "../shared";

const REASON_MAX_LENGTH = 1000;

function untrustedOrUndefined(text: string | undefined, maxLength: number): string | undefined {
  return text == null ? undefined : sanitizeUntrusted(text, maxLength) || undefined;
}

/**
 * One request in the inbox or history. Ids, states and ISO timestamps, plus the requester's name
 * and email and the request reason, which the web vault shows the same approver. Those three are
 * untrusted free text, so they are sanitized and capped, and they are never logged. A decision
 * comment is never written. Vault names appear only with `--names`.
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
  requesterName?: string;
  requesterEmail?: string;
  reason?: string;
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
      this.cipherName = sanitizeUntrusted(names.cipher(row.cipherId), 200);
      this.collectionName = sanitizeUntrusted(names.collection(row.collectionId), 200);
      if (row.organizationId != null) {
        this.organizationName = sanitizeUntrusted(names.organization(row.organizationId), 200);
      }
    }
    this.requesterId = row.requesterId;
    this.requesterName = untrustedOrUndefined(row.requesterName, 200);
    this.requesterEmail = untrustedOrUndefined(row.requesterEmail, 200);
    this.reason = untrustedOrUndefined(row.reason, REASON_MAX_LENGTH);
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
      this.cipherName = sanitizeUntrusted(names.cipher(row.cipherId), 200);
      this.collectionName = sanitizeUntrusted(names.collection(row.collectionId), 200);
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
