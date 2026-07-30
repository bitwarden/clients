import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type { BadgeVariant } from "@bitwarden/components";

import {
  AccessLeaseId,
  AccessLeaseView,
  AccessRequestDecisionView,
  AccessRequestId,
  AccessRequestStatus,
  AccessRequestView,
  findHumanDecision,
  requestedWindowSeconds,
} from "..";

import { ResolvedNames } from "./access-name-resolver.service";

/** Max items rendered per section (no pagination), matching the poc. */
export const MY_ACCESS_PAGE_LIMIT = 50;

/** A row in the Pending or History table on the "My access" page. */
export type MyAccessRequestRow = {
  id: AccessRequestId;
  /** The gated cipher's raw id, for the favicon lookup and as the item name's fallback. */
  cipherId: string;
  collectionId: string;
  /** The gated cipher's display name, or null when it isn't in the caller's local vault. */
  cipherName: string | null;
  /** The collection's display name, or null when it isn't in the caller's local vault. */
  collectionName: string | null;
  status: AccessRequestStatus;
  /** Precomputed badge variant for the status column — see {@link historyDisplayStatus}. */
  statusVariant: BadgeVariant;
  /** Precomputed i18n key for the status column — see {@link historyDisplayStatus}. */
  statusLabelKey: string;
  submittedAt: string;
  resolvedAt: string | null;
  leaseNotBefore: string;
  leaseNotAfter: string;
  /** i18n key for a system / access-rule resolver; null when a human resolved (or still pending). */
  resolverLabelKey: string | null;
  /** The human resolver's display name (name, falling back to email, then id); null otherwise. */
  resolverName: string | null;
  approverComment: string | null;
  /**
   * The raw id of the lease this request minted when activated, or null if it never produced one.
   * Used to fold an extension onto its original and to exclude the row from History while that
   * lease is still active (shown in Active leases instead).
   */
  producedLeaseId: string | null;
  /**
   * Set when this request minted a lease that was later extended: the total time added across all
   * applied extensions, and the lease's current end. Both null when the request was never
   * extended — see {@link buildMyAccessRequestRows}, which folds extension requests into this
   * original row rather than listing them separately.
   */
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
  /**
   * Set when this lease has been extended: the total time added across all applied extensions,
   * and the lease's current end (already reflected in `notAfter`). Both null when never extended.
   */
  extendedBySeconds: number | null;
  extendedUntil: string | null;
};

/** Time an extension (or sum of extensions) added to a lease, and the resulting end (ms). */
export type LeaseExtensionSummary = { addedSeconds: number; latestEndMs: number };

/** Map a status to a badge variant. Exported for tests + storybook fidelity. */
export function statusBadgeVariant(status: AccessRequestStatus): BadgeVariant {
  switch (status) {
    case "approved":
    case "activated":
      return "success";
    case "denied":
      return "danger";
    case "canceled":
      return "subtle";
    case "expired":
      return "warning";
    case "pending":
      return "primary";
    case "unknown":
    default:
      return "subtle";
  }
}

/** i18n key for a status label. Exported for tests. */
export function statusLabelKey(status: AccessRequestStatus): string {
  switch (status) {
    case "approved":
      return "pamStatusApproved";
    case "activated":
      return "pamStatusActivated";
    case "denied":
      return "pamStatusDenied";
    case "canceled":
      return "pamStatusCanceled";
    case "expired":
      return "pamStatusExpired";
    case "pending":
      return "pamStatusPending";
    case "unknown":
    default:
      return "pamStatusUnknown";
  }
}

/**
 * Whether a decision on the log reflects the holder ending their own lease: a human "deny"
 * decision whose decider is the requester themself.
 */
function endedByHolder(request: Pick<AccessRequestView, "requesterId" | "decisions">): boolean {
  return request.decisions.some(
    (d) => d.verdict === "deny" && d.deciderKind === "human" && d.id === request.requesterId,
  );
}

/**
 * Display status + badge for a request. Ported from the poc's `historyDisplayStatus`, adapted to
 * this backend's real `AccessLeaseStatus` (active/expired/revoked/unknown — no "cancelled" value).
 *
 * The poc keyed a self-ended-vs-operator-revoked lease off a mock-only `Cancelled` lease status.
 * This backend collapses both into `revoked`, so the distinction is derived from the decision log
 * instead: a human "deny" decision whose `id` is the requester's own id means the holder ended it
 * themselves ("Cancelled"); any other revoke means an operator did ("Revoked"). An `active`
 * produced lease is labelled like a live grant — callers exclude it from History (it belongs in
 * Active leases) but the detail page's top status field can still render it correctly.
 */
export function historyDisplayStatus(
  request: Pick<
    AccessRequestView,
    "status" | "producedLeaseId" | "producedLeaseStatus" | "decisions" | "requesterId"
  >,
): Pick<MyAccessRequestRow, "statusLabelKey" | "statusVariant"> {
  if (request.status === "activated" && request.producedLeaseId != null) {
    if (request.producedLeaseStatus === "active") {
      return { statusLabelKey: "pamStatusActivated", statusVariant: "success" };
    }
    if (request.producedLeaseStatus === "revoked") {
      return endedByHolder(request)
        ? { statusLabelKey: "pamStatusEndedByYou", statusVariant: "subtle" }
        : { statusLabelKey: "pamStatusRevoked", statusVariant: "subtle" };
    }
    // "expired" (or the SDK's "unknown" default) — the server has no autonomous-expiry push in
    // v1, so a lapsed lease still reads as its last known status; default to Expired here.
    return { statusLabelKey: "pamStatusExpired", statusVariant: "warning" };
  }
  return {
    statusLabelKey: statusLabelKey(request.status),
    statusVariant: statusBadgeVariant(request.status),
  };
}

/**
 * Resolve who actioned a request.
 *
 * The API surfaces the request's decision log. A system / access-rule decision has
 * `deciderKind: "automatic"` (no approver identity); a human decision carries the approver's
 * name/email alongside the id. For a human decision we show the name, falling back to the email,
 * then the raw id if the server could not resolve the user (e.g. a deleted account) — so the
 * column is never blank.
 *
 * Returns an i18n key for system decisions (translated in the template) and a display name for
 * human decisions, keeping localization out of the row model. Exported for tests.
 */
export function resolveResolver(
  status: AccessRequestStatus,
  human: AccessRequestDecisionView | undefined,
): Pick<MyAccessRequestRow, "resolverLabelKey" | "resolverName"> {
  if (status === "pending") {
    return { resolverLabelKey: null, resolverName: null };
  }
  if (human == null) {
    return { resolverLabelKey: "pamResolverAccessRule", resolverName: null };
  }
  return {
    resolverLabelKey: null,
    resolverName: human.name || human.email || (human.id == null ? "" : uuidAsString(human.id)),
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
    approverComment: human?.comment ?? null,
    producedLeaseId: request.producedLeaseId == null ? null : uuidAsString(request.producedLeaseId),
    // Defaults; buildMyAccessRequestRows fills these in for an original whose lease was extended.
    extendedBySeconds: null,
    extendedUntil: null,
  };
}

/**
 * Sum the applied extensions per parent lease id. An applied extension's requested window spans
 * the bump it added ({@link requestedWindowSeconds}) and ends at `leaseNotAfter` (the lease's end
 * after it). The server applies an extension in place on approval and records it `approved`; a
 * still-pending/denied/canceled extension never moved the lease end, so it does not count. Keyed
 * by the parent lease id (`extensionOfLeaseId`), so callers join by lease id.
 */
export function extensionsByLeaseId(
  requests: AccessRequestView[],
): Map<string, LeaseExtensionSummary> {
  const byLease = new Map<string, LeaseExtensionSummary>();
  for (const request of requests) {
    if (
      request.extensionOfLeaseId == null ||
      (request.status !== "approved" && request.status !== "activated")
    ) {
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
 * An extension is modelled as its own {@link AccessRequestView} pointing at the parent lease
 * (`extensionOfLeaseId`); on approval it extends that lease in place rather than minting a new
 * one. Showing each extension as its own row would make a single logical grant look like several
 * duplicate requests, so extensions are folded into the original (activating) request's row
 * instead: the original is badged with the total time added and the lease's current end, and the
 * extension rows themselves are dropped.
 */
export function buildMyAccessRequestRows(
  requests: AccessRequestView[],
  names: ResolvedNames,
): MyAccessRequestRow[] {
  const byLease = extensionsByLeaseId(requests);

  const rows: MyAccessRequestRow[] = [];
  for (const request of requests) {
    if (request.extensionOfLeaseId != null) {
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
