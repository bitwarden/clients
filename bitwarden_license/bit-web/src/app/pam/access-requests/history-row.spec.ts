import { HistoryStatus, toHistoryRow } from "./history-row";
import { MyAccessRequestRow } from "./my-access-row";

const NOW_MS = Date.parse("2026-08-17T12:00:00.000Z");

// Loosely typed, not `Partial<MyAccessRequestRow>`, since `id` is an opaque branded type.
function row(overrides: Record<string, unknown> = {}): MyAccessRequestRow {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    cipherName: "Stripe dashboard",
    collectionName: "Finance",
    status: "denied",
    badgeState: null,
    statusBadge: null,
    submittedAt: "2026-08-17T09:00:00.000Z",
    resolvedAt: "2026-08-17T10:00:00.000Z",
    leaseNotBefore: "2026-08-17T10:00:00.000Z",
    leaseNotAfter: "2026-08-17T11:00:00.000Z",
    resolverLabelKey: null,
    resolverName: null,
    requester: "marcus.chen",
    requesterEmail: "marcus@example.com",
    finalDeny: null,
    approverComment: null,
    producedLeaseId: null,
    producedLeaseStatus: null,
    producedLeaseNotAfter: null,
    extendedBySeconds: null,
    extendedUntil: null,
    ...overrides,
  } as unknown as MyAccessRequestRow;
}

const derekDeny = { name: "derek.finnegan", at: "2026-08-17T10:30:00.000Z" };

function lease(overrides: Record<string, unknown> = {}): MyAccessRequestRow {
  return row({
    status: "approved",
    producedLeaseId: "lease-1",
    producedLeaseStatus: "active",
    producedLeaseNotAfter: "2026-08-17T11:00:00.000Z",
    ...overrides,
  });
}

describe("toHistoryRow", () => {
  it("names the approver who denied a request", () => {
    const history = toHistoryRow(row({ status: "denied", finalDeny: derekDeny }), NOW_MS);

    expect(history).toMatchObject({
      status: HistoryStatus.Denied,
      resolvedBy: { kind: "user", name: "derek.finnegan" },
      resolvedAt: "2026-08-17T10:00:00.000Z",
    });
  });

  it("credits the system with a denial no person made", () => {
    expect(toHistoryRow(row({ status: "denied" }), NOW_MS)?.resolvedBy).toEqual({
      kind: "system",
    });
  });

  it("names the approver who revoked a running lease, at the time they revoked it", () => {
    const history = toHistoryRow(
      lease({ producedLeaseStatus: "revoked", finalDeny: derekDeny }),
      NOW_MS,
    );

    expect(history).toMatchObject({
      status: HistoryStatus.Revoked,
      resolvedBy: { kind: "user", name: "derek.finnegan" },
      resolvedAt: derekDeny.at,
    });
  });

  it("dates an optimistic revoke, whose Deny is not logged yet, to now", () => {
    const history = toHistoryRow(lease({ producedLeaseStatus: "revoked" }), NOW_MS);

    expect(history?.resolvedAtMs).toBe(NOW_MS);
  });

  it("names the requester on a request they canceled", () => {
    expect(toHistoryRow(row({ status: "canceled" }), NOW_MS)).toMatchObject({
      status: HistoryStatus.Canceled,
      resolvedBy: { kind: "user", name: "marcus.chen" },
    });
  });

  it("credits the system with a request that expired undecided, at its window's end", () => {
    expect(toHistoryRow(row({ status: "expired", resolvedAt: null }), NOW_MS)).toMatchObject({
      status: HistoryStatus.Expired,
      resolvedBy: { kind: "system" },
      resolvedAt: "2026-08-17T11:00:00.000Z",
    });
  });

  it("reads an approval never started as Expired once its window closed", () => {
    expect(toHistoryRow(row({ status: "approved" }), NOW_MS)).toMatchObject({
      status: HistoryStatus.Expired,
      resolvedBy: { kind: "system" },
    });
  });

  it("leaves out an approval still waiting to be started", () => {
    const waiting = row({ status: "approved", leaseNotAfter: "2026-08-17T13:00:00.000Z" });

    expect(toHistoryRow(waiting, NOW_MS)).toBeNull();
  });

  it("credits the system when a lease runs out on its own", () => {
    expect(toHistoryRow(lease({ producedLeaseStatus: "expired" }), NOW_MS)).toMatchObject({
      status: HistoryStatus.SessionEnded,
      resolvedBy: { kind: "system" },
      resolvedAt: "2026-08-17T11:00:00.000Z",
    });
  });

  it("names the holder who ended their own access early", () => {
    const ended = lease({
      producedLeaseStatus: "canceled",
      finalDeny: { name: "marcus.chen", at: "2026-08-17T10:45:00.000Z" },
    });

    expect(toHistoryRow(ended, NOW_MS)).toMatchObject({
      status: HistoryStatus.SessionEnded,
      resolvedBy: { kind: "user", name: "marcus.chen" },
      resolvedAt: "2026-08-17T10:45:00.000Z",
    });
  });

  it("leaves out a lease still running", () => {
    const running = lease({ producedLeaseNotAfter: "2026-08-17T13:00:00.000Z" });

    expect(toHistoryRow(running, NOW_MS)).toBeNull();
  });

  it("brings in a lease the server still reports active once its end has passed", () => {
    expect(toHistoryRow(lease(), NOW_MS)).toMatchObject({
      status: HistoryStatus.SessionEnded,
      resolvedBy: { kind: "system" },
      resolvedAt: "2026-08-17T11:00:00.000Z",
    });
  });

  it("holds an extended lease until its extended end", () => {
    const extended = lease({ extendedUntil: "2026-08-17T12:30:00.000Z" });

    expect(toHistoryRow(extended, NOW_MS)).toBeNull();
  });

  it("leaves out a pending request", () => {
    expect(toHistoryRow(row({ status: "pending", resolvedAt: null }), NOW_MS)).toBeNull();
  });

  it("falls back to the cipher id when the item is not in the caller's vault", () => {
    expect(toHistoryRow(row({ cipherName: null }), NOW_MS)?.cipherName).toBe("cipher-1");
  });

  it("names nobody for a requester the server could not resolve", () => {
    expect(toHistoryRow(row({ status: "canceled", requester: "" }), NOW_MS)?.resolvedBy).toEqual({
      kind: "user",
      name: null,
    });
  });
});
