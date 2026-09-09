import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type { BadgeVariant } from "@bitwarden/components";

import {
  AccessLeaseId,
  AccessLeaseStatus,
  AccessLeaseView,
  AccessRequestDecisionView,
  AccessRequestId,
  AccessRequestStatus,
  AccessRequestView,
  findHumanDecision,
  humanApprover,
  requestedWindowSeconds,
} from "..";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";

import { ResolvedNames } from "./access-name-resolver.service";

/** Max items rendered per section (no pagination), matching the poc. */
export const MY_ACCESS_PAGE_LIMIT = 50;

/** A row in the Pending or History table on the "My access" page. */
export type MyAccessRequestRow = {
  id: AccessRequestId;
  /** The gated cipher's raw id, for the favicon lookup and as the item name's fallback. */
  cipherId: string;
  collectionId: string;
  /** The gated cipher's display name; null when absent from the caller's local vault. */
  cipherName: string | null;
  /** The collection's display name; null when absent from the caller's local vault. */
  collectionName: string | null;
  status: AccessRequestStatus;
  /**
   * The shared access-state badge for the status column, so this page, the vault row and the
   * cipher-view modal show one vocabulary. Null for every outcome the shared model cannot state
   * from this row alone — {@link statusBadge} carries those. See {@link historyDisplayStatus}.
   */
  badgeState: AccessBadgeState | null;
  /** Non-null exactly when {@link badgeState} is null — see {@link historyDisplayStatus}. */
  statusBadge: TerminalStatusBadge | null;
  submittedAt: string;
  resolvedAt: string | null;
  leaseNotBefore: string;
  leaseNotAfter: string;
  /** i18n key for a system / access-rule resolver; null for a human resolver, or still pending. */
  resolverLabelKey: string | null;
  /** The human resolver's display name (name, falling back to email, then id); null for a non-human resolver. */
  resolverName: string | null;
  approverComment: string | null;
  /**
   * The raw id of the lease this request minted; null if it never activated one.
   *
   * Excludes the row from History while that lease is active (shown in Active access instead).
   */
  producedLeaseId: string | null;
  /**
   * The produced lease's status as of the read this row was built from; null until activation. The
   * source {@link statusBadge} is derived from, and the honest read for "is this access still
   * running?" — see {@link isLiveManagedLease}.
   */
  producedLeaseStatus: AccessLeaseStatus | null;
  /** Present only if the minted lease was later extended — see {@link buildMyAccessRequestRows}. */
  extendedBySeconds: number | null;
  extendedUntil: string | null;
};

/** An active lease the viewer holds, with names resolved from local vault state. */
export type MyAccessLeaseRow = {
  id: AccessLeaseId;
  /** The request that produced this lease, so the row can link to that request's page. */
  requestId: AccessRequestId;
  cipherId: string;
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
  notBefore: string;
  notAfter: string;
  /** Present only if extended: total time added and the current end (already in `notAfter`). */
  extendedBySeconds: number | null;
  extendedUntil: string | null;
};

/** Colour + copy for a terminal status, which the shared access-state model does not describe. */
export type TerminalStatusBadge = { readonly labelKey: string; readonly variant: BadgeVariant };

/**
 * The statuses whose badge is a plain function of status. `pending` maps onto the shared
 * access-state model instead; `approved`'s badge also depends on the minted lease.
 */
type TerminalRequestStatus = Exclude<AccessRequestStatus, "pending" | "approved">;

/** Time an extension (or sum of extensions) added to a lease, and the resulting end (ms). */
export type LeaseExtensionSummary = { addedSeconds: number; latestEndMs: number };

/** The one sort key every history list orders by: when decided, falling back to when raised. */
export function resolvedOrSubmittedMs(
  row: Pick<MyAccessRequestRow, "resolvedAt" | "submittedAt">,
): number {
  return Date.parse(row.resolvedAt ?? row.submittedAt);
}

/**
 * An approved request that can still become access: not yet activated, and its activation window
 * has not closed. The server refuses to activate past `leaseNotAfter`.
 */
export function isRedeemableGrant(
  row: Pick<MyAccessRequestRow, "status" | "producedLeaseId" | "leaseNotAfter">,
  nowMs: number,
): boolean {
  return (
    row.status === "approved" &&
    row.producedLeaseId == null &&
    Date.parse(row.leaseNotAfter) > nowMs
  );
}

/**
 * The status of a grant whose activation window closed before it was used. {@link
 * historyDisplayStatus} is caller-agnostic and cannot see the clock, so it keeps reading "Approved"
 * for a grant that can no longer produce access.
 */
export const lapsedGrantBadge: TerminalStatusBadge = {
  labelKey: "pamStatusExpired",
  variant: "warning",
};

/** Map a terminal status to its badge. Exported for tests + storybook fidelity. */
export function terminalStatusBadge(status: TerminalRequestStatus): TerminalStatusBadge {
  switch (status) {
    case "denied":
      return { labelKey: "pamStatusDenied", variant: "danger" };
    case "canceled":
      return { labelKey: "pamStatusCanceled", variant: "subtle" };
    case "expired":
      return { labelKey: "pamStatusExpired", variant: "warning" };
    case "unknown":
    default:
      return { labelKey: "pamStatusUnknown", variant: "subtle" };
  }
}

/**
 * Display status + badge for a request.
 *
 * A pending request maps onto the shared access-state model via `AccessStateBadgeComponent`;
 * every other outcome keeps its own label. `canceled`/`revoked` read straight off
 * `producedLeaseStatus` — requester-ended is Canceled, operator-ended is Revoked.
 */
export function historyDisplayStatus(
  request: Pick<AccessRequestView, "status" | "producedLeaseId" | "producedLeaseStatus">,
): Pick<MyAccessRequestRow, "badgeState" | "statusBadge"> {
  if (request.status === "approved") {
    if (request.producedLeaseId == null) {
      // Deliberately not the shared model's "Ready to use": this row also feeds approver surfaces
      // where the viewer holds no lease and can't see leaseNotBefore/leaseNotAfter.
      return terminal("pamStatusApproved", "success");
    }
    if (request.producedLeaseStatus === "active") {
      return terminal("pamStatusActivated", "success");
    }
    if (request.producedLeaseStatus === "canceled") {
      return terminal("pamStatusCanceled", "subtle");
    }
    if (request.producedLeaseStatus === "revoked") {
      return terminal("pamStatusRevoked", "subtle");
    }
    // Covers the SDK's "unknown" default too, plus a lease that lapses after load.
    return terminal("pamStatusExpired", "warning");
  }
  if (request.status === "pending") {
    return { badgeState: { kind: "pending" }, statusBadge: null };
  }
  return { badgeState: null, statusBadge: terminalStatusBadge(request.status) };
}

function terminal(
  labelKey: string,
  variant: BadgeVariant,
): Pick<MyAccessRequestRow, "badgeState" | "statusBadge"> {
  return { badgeState: null, statusBadge: { labelKey, variant } };
}

/**
 * Resolve who actioned a request: an i18n key for system decisions, a display name for human
 * ones (name, falling back to email then raw id).
 *
 * A canceled request was withdrawn by its requester, never logged as a decision; an expired one
 * lapsed with nobody acting, rendering an em dash.
 */
export function resolveResolver(
  status: AccessRequestStatus,
  human: AccessRequestDecisionView | undefined,
): Pick<MyAccessRequestRow, "resolverLabelKey" | "resolverName"> {
  // The terminal transition's actor, not just any human in the log.
  if (status === "pending" || status === "expired") {
    return { resolverLabelKey: null, resolverName: null };
  }
  if (status === "canceled") {
    return { resolverLabelKey: "pamResolverRequester", resolverName: null };
  }
  const approver = human == null ? undefined : humanApprover(human);
  if (approver == null) {
    return { resolverLabelKey: "pamResolverAccessRule", resolverName: null };
  }
  return {
    resolverLabelKey: null,
    resolverName:
      approver.name || approver.email || (approver.id == null ? "" : uuidAsString(approver.id)),
  };
}

export function toRequestRow(request: AccessRequestView, names: ResolvedNames): MyAccessRequestRow {
  const cipherId = uuidAsString(request.cipherId);
  const collectionId = uuidAsString(request.collectionId);
  const human = findHumanDecision(request.decisions);
  return {
    id: request.id,
    cipherId,
    collectionId,
    cipherName: names.cipherNameById.get(cipherId) ?? null,
    collectionName: names.collectionNameById.get(collectionId) ?? null,
    status: request.status,
    ...historyDisplayStatus(request),
    submittedAt: request.submittedAt,
    resolvedAt: request.resolvedAt ?? null,
    leaseNotBefore: request.leaseNotBefore,
    leaseNotAfter: request.leaseNotAfter,
    ...resolveResolver(request.status, human),
    // Falls back to the decision log when no human decided, e.g. an automatic denial.
    approverComment:
      human?.comment ?? request.decisions.find((d) => d.comment != null)?.comment ?? null,
    producedLeaseId: request.producedLeaseId == null ? null : uuidAsString(request.producedLeaseId),
    producedLeaseStatus: request.producedLeaseStatus ?? null,
    // Defaults; buildMyAccessRequestRows fills these in for an original whose lease was extended.
    extendedBySeconds: null,
    extendedUntil: null,
  };
}

/**
 * Sum the applied extensions per parent lease id.
 *
 * An applied extension ends at `leaseNotAfter`; a still-pending/denied/canceled one never moved
 * the lease end, so it does not count. Keyed by `extensionOfLeaseId`.
 */
export function extensionsByLeaseId(
  requests: AccessRequestView[],
): Map<string, LeaseExtensionSummary> {
  const byLease = new Map<string, LeaseExtensionSummary>();
  for (const request of requests) {
    if (request.extensionOfLeaseId == null || request.status !== "approved") {
      continue;
    }
    const leaseKey = uuidAsString(request.extensionOfLeaseId);
    const acc = byLease.get(leaseKey) ?? { addedSeconds: 0, latestEndMs: 0 };
    const endMs = Date.parse(request.leaseNotAfter);
    byLease.set(leaseKey, {
      addedSeconds: acc.addedSeconds + requestedWindowSeconds(request),
      latestEndMs: Math.max(acc.latestEndMs, endMs),
    });
  }
  return byLease;
}

/**
 * Build the rows the "My access" list renders from the caller's raw requests.
 *
 * An extension folds into its original row (`extensionOfLeaseId`), badged with the added time and
 * the lease's current end. A denied extension keeps its own row, since folding it away would
 * leave no record of the request.
 */
export function buildMyAccessRequestRows(
  requests: AccessRequestView[],
  names: ResolvedNames,
): MyAccessRequestRow[] {
  const byLease = extensionsByLeaseId(requests);

  const rows: MyAccessRequestRow[] = [];
  for (const request of requests) {
    if (request.extensionOfLeaseId != null && request.status !== "denied") {
      continue; // Folded into its original row below — never shown on its own.
    }
    const row = toRequestRow(request, names);
    const extension = row.producedLeaseId == null ? undefined : byLease.get(row.producedLeaseId);
    if (extension != null && extension.latestEndMs > 0) {
      row.extendedBySeconds = extension.addedSeconds;
      row.extendedUntil = new Date(extension.latestEndMs).toISOString();
    }
    rows.push(row);
  }
  return rows;
}

export function toLeaseRow(
  lease: AccessLeaseView,
  names: ResolvedNames,
  extension?: LeaseExtensionSummary,
): MyAccessLeaseRow {
  const cipherId = uuidAsString(lease.cipherId);
  const collectionId = uuidAsString(lease.collectionId);
  const extended = extension != null && extension.latestEndMs > 0;
  return {
    id: lease.id,
    requestId: lease.requestId,
    cipherId,
    collectionId,
    cipherName: names.cipherNameById.get(cipherId) ?? null,
    collectionName: names.collectionNameById.get(collectionId) ?? null,
    notBefore: lease.notBefore,
    notAfter: lease.notAfter,
    extendedBySeconds: extended ? extension.addedSeconds : null,
    extendedUntil: extended ? new Date(extension.latestEndMs).toISOString() : null,
  };
}
