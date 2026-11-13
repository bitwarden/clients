import { FoldedAccessRequest } from "@bitwarden/bit-common/pam/requests";
import { liveActiveLease, PamNames, sanitizeUntrusted } from "@bitwarden/bit-common/pam/shared";
import type {
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestSummaryView,
  AccessRequestView,
  CipherAccessStateView,
} from "@bitwarden/sdk-internal";

import { isoDate, PamObject, PamResponse } from "../shared";

/**
 * A request as `list` and `get` print it. Flat, ids, states and ISO UTC timestamps only. The
 * reason, the requester's name and email and the decisions' comments are never written.
 * Activation is not a status: an activated request stays `approved` and shows the lease it
 * produced.
 */
export class AccessRequestResponse extends PamResponse {
  id: string;
  cipherId: string;
  cipherName?: string;
  collectionId: string;
  organizationId?: string;
  organizationName?: string;
  ruleId?: string;
  status: string;
  windowStart?: string;
  windowEnd?: string;
  submittedAt?: string;
  resolvedAt?: string;
  awaitingActivation: boolean;
  producedLeaseId?: string;
  producedLeaseStatus?: string;
  producedLeaseNotAfter?: string;
  extensionOfLeaseId?: string;
  /** Extension requests folded onto this one. Only `list` fills these. */
  extensionRequestIds?: string[];
  extensionPending?: boolean;

  constructor(view: AccessRequestView, names?: PamNames, folded?: FoldedAccessRequest) {
    super(PamObject.Request);
    this.id = String(view.id);
    this.cipherId = String(view.cipherId);
    this.collectionId = String(view.collectionId);
    this.organizationId = view.organizationId == null ? undefined : String(view.organizationId);
    if (names != null) {
      this.cipherName = sanitizeUntrusted(names.cipher(this.cipherId), 200);
      if (this.organizationId != null) {
        this.organizationName = sanitizeUntrusted(names.organization(this.organizationId), 200);
      }
    }
    this.ruleId = view.ruleId == null ? undefined : String(view.ruleId);
    this.status = view.status;
    this.windowStart = isoDate(view.leaseNotBefore);
    this.windowEnd = isoDate(view.leaseNotAfter);
    this.submittedAt = isoDate(view.submittedAt);
    this.resolvedAt = isoDate(view.resolvedAt);
    this.awaitingActivation = view.awaitingActivation;
    this.producedLeaseId = view.producedLeaseId == null ? undefined : String(view.producedLeaseId);
    this.producedLeaseStatus = view.producedLeaseStatus;
    this.producedLeaseNotAfter = isoDate(view.producedLeaseNotAfter);
    this.extensionOfLeaseId =
      view.extensionOfLeaseId == null ? undefined : String(view.extensionOfLeaseId);
    if (folded != null) {
      this.extensionRequestIds = folded.extensionRequestIds;
      this.extensionPending = folded.extensionPending;
    }
  }
}

/**
 * What `create` printed. It tells the operator to run `activate`, because a request never mints
 * a lease: a lease exists only once `activate` succeeds.
 */
export class AccessRequestCreatedResponse extends PamResponse {
  id: string;
  cipherId: string;
  organizationId?: string;
  status: string;
  approvalMode: string;
  windowStart?: string;
  windowEnd?: string;
  submittedAt?: string;
  nextStep: string;
  /** Set on the automatic path while another member holds the item's single active lease. */
  warning?: string;

  constructor(
    summary: AccessRequestSummaryView,
    approvalMode: "automatic" | "human",
    warning?: string,
  ) {
    super(PamObject.Request);
    this.id = String(summary.id);
    this.cipherId = String(summary.cipherId);
    this.organizationId =
      summary.organizationId == null ? undefined : String(summary.organizationId);
    this.status = summary.status;
    this.approvalMode = approvalMode;
    this.windowStart = isoDate(summary.leaseNotBefore);
    this.windowEnd = isoDate(summary.leaseNotAfter);
    this.submittedAt = isoDate(summary.submittedAt);
    this.nextStep =
      approvalMode === "automatic"
        ? `Request created. No lease exists yet. Run \`bw privileged-controls request activate ${this.id}\` to start it.`
        : `Request created and waiting for an approver. No lease exists yet. Once it is approved, run \`bw privileged-controls request activate ${this.id}\`.`;
    this.warning = warning;
  }
}

/**
 * What `activate` printed: the lease that now exists. It never carries the credential, which is
 * read with the lease commands.
 */
export class AccessRequestActivatedResponse extends PamResponse {
  leaseId: string;
  requestId: string;
  cipherId: string;
  organizationId?: string;
  status: string;
  notBefore?: string;
  notAfter?: string;
  nextStep: string;

  constructor(lease: AccessLeaseView) {
    super(PamObject.Lease);
    this.leaseId = String(lease.id);
    this.requestId = String(lease.requestId);
    this.cipherId = String(lease.cipherId);
    this.organizationId = lease.organizationId == null ? undefined : String(lease.organizationId);
    this.status = lease.status;
    this.notBefore = isoDate(lease.notBefore);
    this.notAfter = isoDate(lease.notAfter);
    this.nextStep =
      "Access is active. Activation does not show the credential; read it with the lease commands.";
  }
}

/** What `status` printed, with the pre-check's fields when `--precheck` was given. */
export class CipherAccessStateResponse extends PamResponse {
  cipherId: string;
  cipherName?: string;
  /** The SDK's own ranking of the caller's state, printed as given and never re-ranked. */
  badgeState: string;
  badgeExpiresAt?: string;
  activeLeaseId?: string;
  activeLeaseNotAfter?: string;
  /** True when the SDK still reports a lease whose window has closed. Nothing announces expiry. */
  activeLeaseLapsed?: boolean;
  pendingRequestId?: string;
  approvedRequestId?: string;
  extensionsAllowed: boolean;
  maxExtensionDurationSeconds?: number;
  approvalMode?: string;
  hasActiveLease?: boolean;
  defaultDurationSeconds?: number;
  maxDurationSeconds?: number;
  canStartLease?: boolean;
  slotFreesAt?: string;

  constructor(
    state: CipherAccessStateView,
    options: { preCheck?: AccessPreCheckView; names?: PamNames; nowMs: number },
  ) {
    super(PamObject.AccessState);
    this.cipherId = String(state.cipherId);
    if (options.names != null) {
      this.cipherName = sanitizeUntrusted(options.names.cipher(this.cipherId), 200);
    }
    if (typeof state.badgeState === "string") {
      this.badgeState = state.badgeState;
    } else {
      this.badgeState = "active";
      this.badgeExpiresAt = isoDate(state.badgeState.active.expiresAt);
    }

    const live = liveActiveLease(state, options.nowMs);
    if (live != null) {
      this.activeLeaseId = String(live.id);
      this.activeLeaseNotAfter = isoDate(live.notAfter);
    } else if (state.activeLease != null) {
      this.activeLeaseLapsed = true;
    }
    this.pendingRequestId =
      state.pendingRequest == null ? undefined : String(state.pendingRequest.id);
    this.approvedRequestId =
      state.approvedRequest == null ? undefined : String(state.approvedRequest.id);
    this.extensionsAllowed = live != null && state.extensionsAllowed;
    this.maxExtensionDurationSeconds =
      live != null ? (state.maxExtensionDurationSeconds ?? undefined) : undefined;

    const preCheck = options.preCheck;
    if (preCheck != null) {
      this.approvalMode = preCheck.approvalMode;
      this.hasActiveLease = preCheck.hasActiveLease;
      this.defaultDurationSeconds = preCheck.defaultDurationSeconds;
      this.maxDurationSeconds = preCheck.maxDurationSeconds;
      this.canStartLease = preCheck.canStartLease;
      this.slotFreesAt = isoDate(preCheck.slotFreesAt);
    }
  }
}
