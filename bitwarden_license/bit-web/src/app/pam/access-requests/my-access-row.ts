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
  /** The gated cipher's display name, or null when it isn't in the caller's local vault. */
  cipherName: string | null;
  /** The collection's display name, or null when it isn't in the caller's local vault. */
  collectionName: string | null;
  status: AccessRequestStatus;
  /**
   * The shared access-state badge for the status column, so this page, the vault row and the
   * cipher-view modal show one vocabulary. Null for the terminal statuses, which the shared model
   * has no equivalent for — {@link statusBadge} carries those. See {@link historyDisplayStatus}.
   */
  badgeState: AccessBadgeState | null;
  /** Set exactly when {@link badgeState} is null — see {@link historyDisplayStatus}. */
  statusBadge: TerminalStatusBadge | null;
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

/** Colour + copy for a terminal status, which the shared access-state model does not describe. */
export type TerminalStatusBadge = { readonly labelKey: string; readonly variant: BadgeVariant };

/**
 * The statuses whose badge is NOT taken from the shared access-state model. `pending` and
 * `approved` are excluded because both map onto it — `pending` and `ready` respectively — and
 * routing them here again would fork the vocabulary the three surfaces share.
 */
type TerminalRequestStatus = Exclude<AccessRequestStatus, "pending" | "approved">;

/** Time an extension (or sum of extensions) added to a lease, and the resulting end (ms). */
export type LeaseExtensionSummary = { addedSeconds: number; latestEndMs: number };

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
 * A pending request and an approved-but-unstarted one both have an equivalent in the shared
 * access-state model, so they return an {@link AccessBadgeState} and are rendered by
 * `AccessStateBadgeComponent` — the same recipe the vault row and the cipher-view modal use.
 * Every other outcome is terminal, has no equivalent in that model, and keeps its own label.
 *
 * Activation is not a status of its own: an approved request that minted a lease is recognised by
 * `producedLeaseId`, and the lease's `producedLeaseStatus` drives the label from there.
 *
 `canceled` and `revoked` are distinct lease statuses, so the label reads straight off
 * `producedLeaseStatus`: the requester ending their own lease is "Cancelled", an operator ending it
 * out from under them is "Revoked". An `active` produced lease is labelled like a live grant — callers exclude it from History (it
 * belongs in Active leases) but the detail page's top status field can still render it correctly.
 */
export function historyDisplayStatus(
  request: Pick<AccessRequestView, "status" | "producedLeaseId" | "producedLeaseStatus">,
): Pick<MyAccessRequestRow, "badgeState" | "statusBadge"> {
  if (request.status === "approved") {
    if (request.producedLeaseId == null) {
      return { badgeState: { kind: "ready" }, statusBadge: null };
    }
    if (request.producedLeaseStatus === "active") {
      return terminal("pamStatusActivated", "success");
    }
    if (request.producedLeaseStatus === "canceled") {
      return terminal("pamStatusEndedByYou", "subtle");
    }
    if (request.producedLeaseStatus === "revoked") {
      return terminal("pamStatusRevoked", "subtle");
    }
    // "expired" (or the SDK's "unknown" default) — the server has no autonomous-expiry push in
    // v1, so a lapsed lease still reads as its last known status; default to Expired here.
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
 * Resolve who actioned a request.
 *
 * The API surfaces the request's decision log. A system / access-rule decision has an automatic
 * `decider` (no approver identity); a human decision carries the approver under `decider.human`
 * (name/email/id). For a human decision we show the name, falling back to the email, then the raw
 * id if the server could not resolve the user (e.g. a deleted account) — so the column is never
 * blank.
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
