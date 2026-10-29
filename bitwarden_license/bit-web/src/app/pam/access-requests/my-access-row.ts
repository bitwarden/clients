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

/** Max items rendered per section, since there is no pagination. */
export const MY_ACCESS_PAGE_LIMIT = 50;

/** A request row on the My requests and History tabs. */
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
   * The shared access-state badge for the status column. Null when the shared model can't state
   * the outcome, and {@link statusBadge} carries it instead.
   */
  badgeState: AccessBadgeState | null;
  /** Non-null exactly when {@link badgeState} is null. */
  statusBadge: TerminalStatusBadge | null;
  submittedAt: string;
  resolvedAt: string | null;
  leaseNotBefore: string;
  leaseNotAfter: string;
  /** i18n key when the resolver is the requester, an access rule, or an unknown approver. */
  resolverLabelKey: string | null;
  /** The human resolver's name, falling back to email; null when neither is known. */
  resolverName: string | null;
  approverComment: string | null;
  /** The raw id of the lease this request minted; null if it never activated one. */
  producedLeaseId: string | null;
  /**
   * The produced lease's status as of this row's read; null until activation. {@link statusBadge}
   * derives from it.
   */
  producedLeaseStatus: AccessLeaseStatus | null;
  /** Set only when the minted lease was extended; see {@link buildMyAccessRequestRows}. */
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

/** The sort key every history list orders by. */
export function resolvedOrSubmittedMs(
  row: Pick<MyAccessRequestRow, "resolvedAt" | "submittedAt">,
): number {
  return Date.parse(row.resolvedAt ?? row.submittedAt);
}

/**
 * An approved, unactivated request whose window is still open, since the server refuses to activate
 * past `leaseNotAfter`.
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
 * The badge for a grant whose activation window closed unused. {@link historyDisplayStatus} cannot
 * see the clock, so it still reads "Approved" for one until the next load.
 */
export const lapsedGrantBadge: TerminalStatusBadge = {
  labelKey: "pamStatusExpired",
  variant: "warning",
};

/** Exported for tests. */
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
 * Only a pending request maps onto the shared access-state model; every other outcome keeps its
 * own label. A lease the requester ended reads Canceled, one an operator ended Revoked.
 */
export function historyDisplayStatus(
  request: Pick<AccessRequestView, "status" | "producedLeaseId" | "producedLeaseStatus">,
): Pick<MyAccessRequestRow, "badgeState" | "statusBadge"> {
  if (request.status === "approved") {
    if (request.producedLeaseId == null) {
      // Not the shared model's "Ready to use", since approver surfaces render this row too and
      // that viewer has nothing to use.
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
    // `expired`, plus the SDK's `unknown` default.
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
 * A canceled request was withdrawn by its requester, which logs no decision. Only an empty log
 * means nobody acted, since an approval nobody activated lapses to `expired` with its decision.
 */
export function resolveResolver(
  status: AccessRequestStatus,
  decisions: AccessRequestDecisionView[],
): Pick<MyAccessRequestRow, "resolverLabelKey" | "resolverName"> {
  // The log is oldest first, so an approver's verdict wins over a later retraction or lease end.
  if (status === "pending") {
    return { resolverLabelKey: null, resolverName: null };
  }
  if (status === "canceled") {
    return { resolverLabelKey: "pamResolverRequester", resolverName: null };
  }
  const human = findHumanDecision(decisions);
  const approver = human == null ? undefined : humanApprover(human);
  if (approver == null) {
    return decisions.length === 0
      ? { resolverLabelKey: null, resolverName: null }
      : { resolverLabelKey: "pamResolverAccessRule", resolverName: null };
  }
  const name = approver.name || approver.email || null;
  return {
    resolverLabelKey: name == null ? "pamResolverUnknown" : null,
    resolverName: name,
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
    ...resolveResolver(request.status, request.decisions),
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
 * Sums the applied extensions per parent lease id. Only an approved extension moved the lease end,
 * so no other status counts.
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
 * An extension folds into its original row, badged with the added time and the lease's current
 * end. A denied extension keeps its own row, or nothing would record it.
 */
export function buildMyAccessRequestRows(
  requests: AccessRequestView[],
  names: ResolvedNames,
): MyAccessRequestRow[] {
  const byLease = extensionsByLeaseId(requests);

  const rows: MyAccessRequestRow[] = [];
  for (const request of requests) {
    if (request.extensionOfLeaseId != null && request.status !== "denied") {
      continue; // Folded into its original row below.
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
