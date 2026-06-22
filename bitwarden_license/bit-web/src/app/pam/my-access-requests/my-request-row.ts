import { BadgeVariant } from "@bitwarden/components";
import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  Decision,
  findHumanDecision,
} from "@bitwarden/pam";

/** Max items rendered per section (no pagination). */
export const MY_REQUESTS_PAGE_LIMIT = 50;

export type MyRequestRow = {
  id: string;
  cipherId: string;
  /**
   * Cipher and collection names resolved from local vault state (the gated cipher's
   * already-decrypted name and its CollectionView). `cipherName` is null when the
   * cipher isn't in the vault, so the template falls back to `cipherId`; `collectionName`
   * is null when unknown.
   */
  cipherName: string | null;
  collectionName: string | null;
  status: AccessRequestStatus;
  /** Precomputed badge variant for `status`, so the template avoids a per-row method call. */
  statusVariant: BadgeVariant;
  /** Precomputed i18n key for `status`, so the template avoids a per-row method call. */
  statusLabelKey: string;
  submittedAt: Date;
  resolvedAt: Date | null;
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  /** i18n key for a system / access-rule resolver; null when a human resolved. */
  resolverLabelKey: string | null;
  /** The human resolver's display name (name, falling back to email, then id); null otherwise. */
  resolverName: string | null;
  approverComment: string | null;
  /** Deadline to activate an approved on-demand request; null for other states. */
  activationDeadline: Date | null;
  /**
   * The lease this request minted when activated, or null if it never produced one. Used to fold an
   * extension onto its original and to suppress the History row while that lease is still active (it
   * is shown in Active leases instead).
   */
  producedLeaseId: string | null;
  /**
   * Set when this request minted a lease that was later extended: the total time added across all
   * applied extensions, and the lease's current end. Both null when the request was never
   * extended. The list folds extension requests into this original row (see {@link buildMyRequestRows})
   * rather than listing them separately, and badges the row with these.
   */
  extendedBySeconds: number | null;
  extendedUntil: Date | null;
};

/** An active lease the viewer holds, with names resolved from local vault state. */
export type LeaseRow = {
  id: string;
  cipherId: string;
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
  notBefore: Date;
  notAfter: Date;
  /**
   * Set when this lease has been extended: the total time added across all applied extensions, and
   * the lease's current end. Both null when never extended. Lets Active leases badge an extended
   * lease ("Extended +30m · until …"); `notAfter` already reflects the extension.
   */
  extendedBySeconds: number | null;
  extendedUntil: Date | null;
};

/** Time an extension (or sum of extensions) added to a lease, and the resulting end (ms). */
export type LeaseExtensionSummary = { addedSeconds: number; latestEndMs: number };

/** Map a status to a badge variant. Exported for tests + storybook fidelity. */
export function statusBadgeVariant(status: AccessRequestStatus): BadgeVariant {
  switch (status) {
    case AccessRequestStatus.Approved:
      return "success";
    case AccessRequestStatus.Activated:
      return "success";
    case AccessRequestStatus.Denied:
      return "danger";
    case AccessRequestStatus.Cancelled:
      return "subtle";
    case AccessRequestStatus.Expired:
      return "warning";
    case AccessRequestStatus.Pending:
      return "primary";
  }
}

/** i18n key for a status label. Exported for tests. */
export function statusLabelKey(status: AccessRequestStatus): string {
  switch (status) {
    case AccessRequestStatus.Approved:
      return "pamStatusApproved";
    case AccessRequestStatus.Activated:
      return "pamStatusActivated";
    case AccessRequestStatus.Denied:
      return "pamStatusDenied";
    case AccessRequestStatus.Cancelled:
      return "pamStatusCancelled";
    case AccessRequestStatus.Expired:
      return "pamStatusExpired";
    case AccessRequestStatus.Pending:
      return "pamStatusPending";
  }
}

/**
 * Resolve who actioned a request.
 *
 * The API surfaces the request's decision log. A system / access-rule decision has
 * `deciderKind: "automatic"` (no approver identity); a human decision carries the
 * approver's name/email alongside the id. For a human decision we show the name,
 * falling back to the email, then the raw id if the server could not resolve the
 * user (e.g. a deleted account) — so the column is never blank.
 *
 * Returns an i18n key for system decisions (translated in the template) and a
 * display name for human decisions, keeping localization out of the row model.
 * Exported for tests.
 */
export function resolveResolver(
  status: AccessRequestStatus,
  human: Decision | undefined,
): Pick<MyRequestRow, "resolverLabelKey" | "resolverName"> {
  // Show the human decider's name; a still-pending request shows neither, and an automatic
  // (access-rule) decision — or no human decision — shows the access-rule label.
  if (status === AccessRequestStatus.Pending) {
    return { resolverLabelKey: null, resolverName: null };
  }
  if (human == null) {
    return { resolverLabelKey: "pamResolverAccessRule", resolverName: null };
  }
  return {
    resolverLabelKey: null,
    resolverName: human.name || human.email || human.id,
  };
}

export function toRow(response: AccessRequestDetailsResponse): MyRequestRow {
  const human = findHumanDecision(response.decisions);
  return {
    id: response.id,
    cipherId: response.cipherId,
    cipherName: response.cipherName,
    collectionName: response.collectionName,
    status: response.status,
    statusVariant: statusBadgeVariant(response.status),
    statusLabelKey: statusLabelKey(response.status),
    submittedAt: new Date(response.submittedAt),
    resolvedAt: response.resolvedAt == null ? null : new Date(response.resolvedAt),
    requestedNotBefore:
      response.requestedNotBefore == null ? null : new Date(response.requestedNotBefore),
    requestedNotAfter:
      response.requestedNotAfter == null ? null : new Date(response.requestedNotAfter),
    requestedTtlSeconds: response.requestedTtlSeconds,
    ...resolveResolver(response.status, human),
    approverComment: human?.comment ?? null,
    activationDeadline:
      response.activationDeadline == null ? null : new Date(response.activationDeadline),
    producedLeaseId: response.producedLeaseId,
    // Defaults; buildMyRequestRows fills these in for an original whose lease was extended.
    extendedBySeconds: null,
    extendedUntil: null,
  };
}

/**
 * Build the rows the "My Requests" list renders from the caller's raw requests.
 *
 * An extension is modelled as its own {@link AccessRequestDetailsResponse} pointing at the parent
 * lease (`extensionOfLeaseId`); on approval it extends that lease in place rather than minting a new
 * one. Showing each extension as its own row makes a single logical grant look like several
 * duplicate requests, so we fold extensions into the original (activating) request's row instead:
 * the original is badged with the total time added and the lease's current end, and the extension
 * rows themselves are dropped.
 *
 * The join is self-contained on the extension's own fields: an applied extension carries
 * `requestedTtlSeconds` (the bump it added) and `requestedNotAfter` (the lease's end after it), and
 * the original that minted the lease has `producedLeaseId` equal to the same parent lease id the
 * extensions point at. The server applies an extension in place on approval and records it
 * `approved`; the mock/spec records it `activated`. Either counts toward the badge — a
 * pending/denied/cancelled extension never moved the lease end, so it does not.
 */
/**
 * Sum the applied extensions per parent lease id. An applied extension carries `requestedTtlSeconds`
 * (the bump it added) and `requestedNotAfter` (the lease's end after it). The server applies an
 * extension in place on approval and records it `approved`; the mock/spec records it `activated`.
 * Either counts — a pending/denied/cancelled extension never moved the lease end, so it does not.
 * Keyed by the parent lease id (`extensionOfLeaseId`), so callers join by lease id.
 */
export function extensionsByLeaseId(
  responses: AccessRequestDetailsResponse[],
): Map<string, LeaseExtensionSummary> {
  const byLease = new Map<string, LeaseExtensionSummary>();
  for (const response of responses) {
    // The leading null check also narrows `extensionOfLeaseId` to non-null for the Map key below.
    if (
      response.extensionOfLeaseId == null ||
      (response.status !== AccessRequestStatus.Approved &&
        response.status !== AccessRequestStatus.Activated)
    ) {
      continue;
    }
    const acc = byLease.get(response.extensionOfLeaseId) ?? { addedSeconds: 0, latestEndMs: 0 };
    const endMs = response.requestedNotAfter == null ? 0 : Date.parse(response.requestedNotAfter);
    byLease.set(response.extensionOfLeaseId, {
      addedSeconds: acc.addedSeconds + response.requestedTtlSeconds,
      latestEndMs: Math.max(acc.latestEndMs, endMs),
    });
  }
  return byLease;
}

export function buildMyRequestRows(responses: AccessRequestDetailsResponse[]): MyRequestRow[] {
  const byLease = extensionsByLeaseId(responses);

  const rows: MyRequestRow[] = [];
  for (const response of responses) {
    if (response.extensionOfLeaseId != null) {
      continue; // Folded into its original row below — never shown on its own.
    }
    const row = toRow(response);
    const extension =
      response.producedLeaseId == null ? undefined : byLease.get(response.producedLeaseId);
    if (extension != null && extension.latestEndMs > 0) {
      row.extendedBySeconds = extension.addedSeconds;
      row.extendedUntil = new Date(extension.latestEndMs);
    }
    rows.push(row);
  }
  return rows;
}

export function toLeaseRow(
  lease: AccessLeaseResponse,
  names: { cipherNameById: Map<string, string>; collectionNameById: Map<string, string> },
  extension?: LeaseExtensionSummary,
): LeaseRow {
  const extended = extension != null && extension.latestEndMs > 0;
  return {
    id: lease.id,
    cipherId: lease.cipherId,
    collectionId: lease.collectionId,
    cipherName: names.cipherNameById.get(lease.cipherId) ?? null,
    collectionName: names.collectionNameById.get(lease.collectionId) ?? null,
    notBefore: new Date(lease.notBefore),
    notAfter: new Date(lease.notAfter),
    extendedBySeconds: extended ? extension.addedSeconds : null,
    extendedUntil: extended ? new Date(extension.latestEndMs) : null,
  };
}
