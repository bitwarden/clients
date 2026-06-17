import { AccessLeaseStatus, AccessRequestDetailsResponse } from "@bitwarden/pam";

import { humanDecision } from "../testing/decision-builders";

import {
  flattenHistory,
  groupHistory,
  historyRelTimeFor,
  historyStatusLabelFor,
  resolveApprover,
} from "./history-row";

describe("history bucketing and labels (deferred lease minting)", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const earlier = "2026-06-10T11:00:00Z";
  const later = "2026-06-10T13:00:00Z";
  const muchLater = "2026-06-10T14:00:00Z";

  function historyRow(
    overrides: Partial<{
      id: string;
      status: string;
      producedLeaseId: string | null;
      producedLeaseStatus: AccessLeaseStatus | null;
      requestedNotBefore: string | null;
      requestedNotAfter: string | null;
    }> = {},
  ): AccessRequestDetailsResponse {
    const producedLeaseId = overrides.producedLeaseId ?? null;
    return new AccessRequestDetailsResponse({
      Id: overrides.id ?? "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      RequesterId: "user-2",
      Status: overrides.status ?? "approved",
      RequestedNotBefore: overrides.requestedNotBefore ?? earlier,
      RequestedNotAfter: overrides.requestedNotAfter ?? later,
      RequestedTtlSeconds: 3600,
      SubmittedAt: "2026-06-10T10:00:00Z",
      ProducedLeaseId: producedLeaseId,
      // A minted lease defaults to "active"; tests that exercise an ended lease override this.
      ProducedLeaseStatus:
        overrides.producedLeaseStatus ?? (producedLeaseId != null ? "active" : null),
    });
  }

  const bucketOf = (item: AccessRequestDetailsResponse) => {
    const groups = groupHistory([item], now);
    return groups.length > 0 ? groups[0].bucket : null;
  };

  it("buckets an activated request with a live window as Active", () => {
    const item = historyRow({ status: "activated", producedLeaseId: "lease-1" });
    expect(bucketOf(item)).toBe("active");
  });

  it("buckets an activated request with a lapsed window as Past (no Revoke on unusable access)", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      requestedNotBefore: "2026-06-10T09:00:00Z",
      requestedNotAfter: "2026-06-10T10:00:00Z",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("buckets a revoked lease with a live window as Past, never Active", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "revoked",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("buckets an expired lease as Past", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "expired",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("never buckets an approved-but-not-started request as Active, even with a live window", () => {
    const item = historyRow({ status: "approved", producedLeaseId: null });
    expect(bucketOf(item)).toBe("future");
  });

  it("buckets an approved-but-not-started request with a future window as Upcoming", () => {
    const item = historyRow({
      status: "approved",
      producedLeaseId: null,
      requestedNotBefore: later,
      requestedNotAfter: muchLater,
    });
    expect(bucketOf(item)).toBe("future");
  });

  it("buckets an approved request whose window lapsed unstarted as Past", () => {
    const item = historyRow({
      status: "approved",
      producedLeaseId: null,
      requestedNotBefore: "2026-06-10T09:00:00Z",
      requestedNotAfter: "2026-06-10T10:00:00Z",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("buckets denied requests as Past regardless of window", () => {
    const item = historyRow({ status: "denied" });
    expect(bucketOf(item)).toBe("past");
  });

  it("labels an awaiting-start row 'Approved · not started', not 'Upcoming'", () => {
    const item = historyRow({ status: "approved", producedLeaseId: null });
    expect(historyStatusLabelFor("future", item)).toBe("pamInboxHistoryStatusAwaitingStart");
  });

  it("labels a revoked lease 'Revoked', not by the request status", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "revoked",
    });
    expect(historyStatusLabelFor("past", item)).toBe("pamInboxHistoryStatusRevoked");
  });

  it("labels a scheduled minted lease 'Upcoming'", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      requestedNotBefore: later,
      requestedNotAfter: muchLater,
    });
    expect(historyStatusLabelFor("future", item)).toBe("pamInboxHistoryGroupFuture");
  });

  it("shows how long an open-window approval stays startable", () => {
    const item = historyRow({ status: "approved", producedLeaseId: null });
    expect(historyRelTimeFor(item, "future", now)).toEqual({
      key: "pamInboxHistoryStartableFor",
      value: "1h",
    });
  });

  it("shows when a future-window approval becomes startable", () => {
    const item = historyRow({
      status: "approved",
      producedLeaseId: null,
      requestedNotBefore: later,
      requestedNotAfter: muchLater,
    });
    expect(historyRelTimeFor(item, "future", now)).toEqual({
      key: "pamInboxHistoryStartsIn",
      value: "1h",
    });
  });
});

describe("flattenHistory", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  function activatedRow(id: string, leaseStatus: AccessLeaseStatus): AccessRequestDetailsResponse {
    return new AccessRequestDetailsResponse({
      Id: id,
      CipherId: "cipher-1",
      CollectionId: "col-1",
      RequesterId: "user-2",
      Status: "activated",
      RequestedNotBefore: "2026-06-10T11:00:00Z",
      RequestedNotAfter: "2026-06-10T13:00:00Z",
      RequestedTtlSeconds: 3600,
      SubmittedAt: "2026-06-10T10:00:00Z",
      ResolvedAt: "2026-06-10T10:30:00Z",
      ProducedLeaseId: "lease-" + id,
      ProducedLeaseStatus: leaseStatus,
    });
  }

  it("offers Revoke on an active managed lease", () => {
    const rows = flattenHistory([activatedRow("a", "active")], now);
    expect(rows[0].canRevoke).toBe(true);
  });

  it("withholds actions when canActOn returns false (rows the viewer can only see)", () => {
    const rows = flattenHistory([activatedRow("a", "active")], now, () => false);
    expect(rows[0].canRevoke).toBe(false);
    expect(rows[0].canCancel).toBe(false);
  });

  it("carries a time sort key from resolvedAt", () => {
    const rows = flattenHistory([activatedRow("a", "active")], now);
    expect(rows[0].sortTimeMs).toBe(Date.parse("2026-06-10T10:30:00Z"));
  });

  it("carries the resolved approver identity onto each row", () => {
    const item = new AccessRequestDetailsResponse({
      Id: "a",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      RequesterId: "user-2",
      Status: "denied",
      RequestedNotBefore: "2026-06-10T11:00:00Z",
      RequestedNotAfter: "2026-06-10T13:00:00Z",
      RequestedTtlSeconds: 3600,
      SubmittedAt: "2026-06-10T10:00:00Z",
      ResolvedAt: "2026-06-10T10:30:00Z",
      Decisions: [
        {
          DeciderKind: "human",
          Id: "user-9",
          Name: "Ada Approver",
          Email: "ada@example.com",
          Comment: null,
          Verdict: 1,
          DecidedAt: "2026-06-10T10:30:00Z",
        },
      ],
    });
    const rows = flattenHistory([item], now);
    expect(rows[0].approverLabelKey).toBeNull();
    expect(rows[0].approverName).toBe("Ada Approver");
  });
});

describe("resolveApprover", () => {
  it("returns neither label nor name for a pending request", () => {
    expect(resolveApprover("pending", undefined)).toEqual({
      approverLabelKey: null,
      approverName: null,
    });
  });

  it("returns the access-rule label when no human decided", () => {
    expect(resolveApprover("approved", undefined)).toEqual({
      approverLabelKey: "pamResolverAccessRule",
      approverName: null,
    });
  });

  it("shows the approver name, then email, then id when a human decided", () => {
    expect(
      resolveApprover(
        "approved",
        humanDecision({ id: "user-9", name: "Ada Approver", email: "ada@example.com" }),
      ).approverName,
    ).toBe("Ada Approver");
    expect(
      resolveApprover(
        "denied",
        humanDecision({ id: "user-9", name: null, email: "ada@example.com" }),
      ).approverName,
    ).toBe("ada@example.com");
    expect(
      resolveApprover("denied", humanDecision({ id: "user-9", name: null, email: null }))
        .approverName,
    ).toBe("user-9");
  });
});
