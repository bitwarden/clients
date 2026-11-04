import {
  AccessBadgeState,
  ENDING_SOON_THRESHOLD_MS,
  durationText,
  exactWindow,
} from "@bitwarden/bit-pam";
import type { AccessRequestId, AccessRequestView } from "@bitwarden/bit-pam";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import { ResolvedNames } from "../access-requests/access-name-resolver.service";

import { ApprovalRow } from "./approval-row";
import { ManagedLeaseRow } from "./managed-lease-row";

/** The Status filter's options. "In use" and "Ending soon" split one lease by its live clock. */
export const ApproverRowStatus = Object.freeze({
  Pending: "pending",
  Ready: "ready",
  InUse: "inUse",
  EndingSoon: "endingSoon",
} as const);
export type ApproverRowStatus = (typeof ApproverRowStatus)[keyof typeof ApproverRowStatus];

type ApproverRowBase = {
  /** The request's id as a string, unique across every kind of row. */
  id: string;
  requestId: AccessRequestId;
  cipherId: string;
  collectionId: string;
  /** The gated cipher's display name, falling back to its raw id when absent from the local vault. */
  cipherName: string;
  collectionName: string | null;
  /** The requester's name, falling back to email, then blank when the server resolved neither. */
  requester: string;
  requesterEmail: string | null;
  duration: string;
  exactWindow: string;
  /** Sort key for the Requested window column. */
  windowStartMs: number;
  /** The window's effective end, which an active lease's extensions move. */
  windowEndMs: number;
  /** Lowercased haystack for the free-text filter. */
  searchText: string;
};

/**
 * A row on the Approvals tab, one per request at any stage the approver can still act on:
 * awaiting a decision, approved but not started, or running.
 */
export type ApproverRow =
  | (ApproverRowBase & { kind: "pending"; approval: ApprovalRow })
  | (ApproverRowBase & { kind: "ready" })
  | (ApproverRowBase & { kind: "active"; lease: ManagedLeaseRow });

export function fromApprovalRow(approval: ApprovalRow): ApproverRow {
  const request = approval.request;
  return {
    kind: "pending",
    approval,
    id: uuidAsString(approval.id),
    requestId: approval.id,
    cipherId: approval.cipherId,
    collectionId: approval.collectionId,
    cipherName: approval.cipherName,
    collectionName: approval.collectionName,
    requester: approval.requester,
    requesterEmail: approval.requesterEmail,
    duration: approval.duration,
    exactWindow: approval.exactWindow,
    windowStartMs: Date.parse(request.leaseNotBefore),
    windowEndMs: Date.parse(request.leaseNotAfter),
    searchText: approval.searchText,
  };
}

/** An approval the requester has not started; see `isUnstartedApproval`. */
export function fromUnstartedApproval(
  request: AccessRequestView,
  names: ResolvedNames,
  locale: string,
): ApproverRow {
  const cipherId = uuidAsString(request.cipherId);
  const collectionId = uuidAsString(request.collectionId);
  const cipherName = names.cipherNameById.get(cipherId) ?? cipherId;
  const collectionName = names.collectionNameById.get(collectionId) ?? null;

  return {
    kind: "ready",
    id: uuidAsString(request.id),
    requestId: request.id,
    cipherId,
    collectionId,
    cipherName,
    collectionName,
    requester: request.requesterName || request.requesterEmail || "",
    requesterEmail: request.requesterEmail ?? null,
    duration: durationText(request, locale),
    exactWindow: exactWindow(request, locale),
    windowStartMs: Date.parse(request.leaseNotBefore),
    windowEndMs: Date.parse(request.leaseNotAfter),
    searchText: [cipherName, collectionName, request.requesterName, request.requesterEmail]
      .filter((value): value is string => !!value)
      .join(" ")
      .toLowerCase(),
  };
}

/** Reads the window off the lease, so an extension shows in the duration and the end. */
export function fromManagedLease(lease: ManagedLeaseRow, locale: string): ApproverRow {
  const window = { leaseNotBefore: lease.startsAt, leaseNotAfter: lease.endsAt };
  return {
    kind: "active",
    lease,
    id: uuidAsString(lease.requestId),
    requestId: lease.requestId,
    cipherId: lease.cipherId,
    collectionId: lease.collectionId,
    cipherName: lease.cipherName,
    collectionName: lease.collectionName,
    requester: lease.requester,
    requesterEmail: lease.requesterEmail,
    duration: durationText(window, locale),
    exactWindow: exactWindow(window, locale),
    windowStartMs: Date.parse(lease.startsAt),
    windowEndMs: lease.endsAtMs,
    searchText: lease.searchText,
  };
}

/** Reads the clock, since a running lease turns "Ending soon" with no change to its data. */
export function approverRowStatus(row: ApproverRow, nowMs: number): ApproverRowStatus {
  switch (row.kind) {
    case "pending":
      return ApproverRowStatus.Pending;
    case "ready":
      return ApproverRowStatus.Ready;
    case "active":
      return row.windowEndMs - nowMs <= ENDING_SOON_THRESHOLD_MS
        ? ApproverRowStatus.EndingSoon
        : ApproverRowStatus.InUse;
  }
}

/** The badge's own countdown escalates an active lease to "Ending soon". */
export function approverBadgeState(row: ApproverRow): AccessBadgeState {
  return row.kind === "active"
    ? { kind: "active", expiresAt: new Date(row.windowEndMs) }
    : { kind: row.kind };
}

const KIND_ORDER: Record<ApproverRow["kind"], number> = { pending: 0, ready: 1, active: 2 };

/** Lifecycle order, then the soonest end first, so the leases about to lapse sort together. */
export function compareApproverStatus(a: ApproverRow, b: ApproverRow): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.windowEndMs - b.windowEndMs;
}
