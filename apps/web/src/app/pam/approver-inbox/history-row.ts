import {
  AccessRequestDetailsResponse,
  AccessLeaseStatus,
  AccessRequestStatus,
  formatRemaining,
} from "@bitwarden/pam";

/** Time-bucket a history item belongs to. */
export type BucketKey = "active" | "future" | "past";

/** Filter value for a history table: a specific bucket or "all". */
export type HistoryFilter = BucketKey | "all";

/** A single row in a flat history table — all display fields pre-computed. */
export type FlatHistoryRow = {
  item: AccessRequestDetailsResponse;
  bucket: BucketKey;
  canRevoke: boolean;
  canCancel: boolean;
  statusClass: string; // Tailwind colour classes for the status label
  statusLabel: string; // i18n key
  relTime: { key: string; value: string } | null;
  /** Epoch ms used as the table's time sort key (resolved time, falling back to submit time). */
  sortTimeMs: number;
};

/** An approved request that has not produced a lease yet: the requester may still start it. */
export function isAwaitingStart(item: AccessRequestDetailsResponse): boolean {
  return item.status === AccessRequestStatus.Approved && item.producedLeaseId == null;
}

export function historyStatusClassFor(bucket: BucketKey, status: string): string {
  if (bucket === "active") {
    return "tw-text-success-700";
  }
  if (bucket === "future") {
    return "tw-text-primary-600";
  }
  if (status === AccessRequestStatus.Denied) {
    return "tw-text-danger-700";
  }
  return "tw-text-muted";
}

export function historyStatusLabelFor(
  bucket: BucketKey,
  item: AccessRequestDetailsResponse,
): string {
  if (bucket === "active") {
    return "pamInboxHistoryGroupActive";
  }
  if (bucket === "future") {
    // An approved-but-not-started request grants nothing yet — say so instead of "Upcoming",
    // which is reserved for a minted lease whose window hasn't opened.
    return isAwaitingStart(item)
      ? "pamInboxHistoryStatusAwaitingStart"
      : "pamInboxHistoryGroupFuture";
  }
  // A produced lease that has ended is labelled by the lease outcome, not the request status (which
  // stays "activated"): distinguish a manually revoked lease from one that lapsed.
  if (item.producedLeaseStatus === AccessLeaseStatus.Revoked) {
    return "pamInboxHistoryStatusRevoked";
  }
  if (item.producedLeaseStatus === AccessLeaseStatus.Expired) {
    return "pamInboxHistoryStatusExpired";
  }
  switch (item.status) {
    case AccessRequestStatus.Approved:
      return "pamInboxHistoryStatusApproved";
    case AccessRequestStatus.Activated:
      return "pamInboxHistoryStatusActivated";
    case AccessRequestStatus.Denied:
      return "pamInboxHistoryStatusDenied";
    case AccessRequestStatus.Expired:
      return "pamInboxHistoryStatusExpired";
    default:
      return "pamInboxHistoryStatusCancelled";
  }
}

export function historyRelTimeFor(
  item: AccessRequestDetailsResponse,
  bucket: BucketKey,
  now: Date,
): { key: string; value: string } | null {
  if (bucket === "future") {
    const notBeforeMs = item.requestedNotBefore ? Date.parse(item.requestedNotBefore) : null;
    if (notBeforeMs != null && notBeforeMs > now.getTime()) {
      return {
        key: "pamInboxHistoryStartsIn",
        value: formatRemaining(notBeforeMs - now.getTime()),
      };
    }
    // Awaiting start inside an already-open window: show how long the approval stays startable.
    if (isAwaitingStart(item) && item.requestedNotAfter) {
      const startable = formatRemaining(Date.parse(item.requestedNotAfter) - now.getTime());
      if (startable === "0s") {
        return null;
      }
      return { key: "pamInboxHistoryStartableFor", value: startable };
    }
    return null;
  }
  if (bucket === "active" && item.requestedNotAfter) {
    const remaining = formatRemaining(Date.parse(item.requestedNotAfter) - now.getTime());
    if (remaining === "0s") {
      return null;
    }
    return { key: "pamInboxHistoryTimeRemaining", value: remaining };
  }
  return null;
}

export type HistoryGroup = {
  bucket: BucketKey;
  items: AccessRequestDetailsResponse[];
};

export function groupHistory(items: AccessRequestDetailsResponse[], now: Date): HistoryGroup[] {
  const nowMs = now.getTime();
  const future: AccessRequestDetailsResponse[] = [];
  const active: AccessRequestDetailsResponse[] = [];
  const past: AccessRequestDetailsResponse[] = [];

  for (const item of items) {
    const notBefore = item.requestedNotBefore ? Date.parse(item.requestedNotBefore) : null;
    const notAfter = item.requestedNotAfter ? Date.parse(item.requestedNotAfter) : null;

    // A minted lease is real access only while its status is still "active": a revoked or expired
    // lease drops to Past regardless of its window, so the inbox never offers Revoke on a lease that
    // has already ended (the request itself stays "activated" forever). Check each bound
    // independently: a lease that starts immediately has notBefore=null but is still active if
    // notAfter is in the future. A lease whose window has fully lapsed also drops to Past — its
    // access can no longer be used, so Revoke would be a no-op (the real lapse-to-expired transition
    // is a server concern; v1 has no autonomous expiry yet).
    if (
      (item.status === AccessRequestStatus.Activated || item.producedLeaseId != null) &&
      item.producedLeaseStatus === AccessLeaseStatus.Active
    ) {
      if (notBefore != null && notBefore > nowMs) {
        future.push(item);
        continue;
      }
      if (notAfter != null && notAfter >= nowMs) {
        active.push(item);
        continue;
      }
    } else if (
      item.status === AccessRequestStatus.Approved &&
      (notAfter == null || notAfter >= nowMs)
    ) {
      // Approved but not started: the requester can still mint the lease, so the grant belongs
      // with Upcoming — never Active. Once the window lapses unstarted it falls through to Past.
      future.push(item);
      continue;
    }
    past.push(item);
  }

  return (
    [
      { bucket: "active", items: active },
      { bucket: "future", items: future },
      { bucket: "past", items: past },
    ] satisfies HistoryGroup[]
  ).filter((g) => g.items.length > 0);
}

/**
 * Flatten history items (active → upcoming → past) into pre-computed display rows.
 *
 * `canActOn` gates the per-row Revoke / Cancel-approval affordances: the audit log can see
 * history the viewer can't act on (their own resolved requests alongside the managed-collection
 * decisions), so actions are offered only where the predicate allows. Defaults to "every row",
 * matching the approver decision history where every row is the viewer's to manage.
 */
export function flattenHistory(
  items: AccessRequestDetailsResponse[],
  now: Date,
  canActOn: (item: AccessRequestDetailsResponse) => boolean = () => true,
): FlatHistoryRow[] {
  const nowMs = now.getTime();
  return groupHistory(items, now).flatMap(({ bucket, items: bucketItems }) =>
    bucketItems.map((item): FlatHistoryRow => {
      const actionable = canActOn(item);
      return {
        item,
        bucket,
        canRevoke:
          actionable &&
          (bucket === "active" || bucket === "future") &&
          item.producedLeaseId != null &&
          item.producedLeaseStatus === AccessLeaseStatus.Active,
        // An approved request that has not minted a lease and whose window can still produce access
        // can be retracted by the approver (cancel the approval). A window-passed approval can no
        // longer be started, so — like a lapsed lease — it is offered no action and sits in history.
        canCancel:
          actionable &&
          isAwaitingStart(item) &&
          (item.requestedNotAfter == null || Date.parse(item.requestedNotAfter) >= nowMs),
        statusClass: historyStatusClassFor(bucket, item.status),
        statusLabel: historyStatusLabelFor(bucket, item),
        relTime: historyRelTimeFor(item, bucket, now),
        sortTimeMs: Date.parse(item.resolvedAt ?? item.submittedAt),
      };
    }),
  );
}
