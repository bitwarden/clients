import type { AccessLeaseId, AccessRequestView } from "../abstractions/access-lease";
import { emptyResolvedNames } from "../access-requests/access-name-resolver.service";

import { toApprovalRow } from "./approval-row";
import {
  ApproverRowStatus,
  approverBadgeState,
  approverRowStatus,
  compareApproverStatus,
  fromApprovalRow,
  fromManagedLease,
  fromUnstartedApproval,
} from "./approver-row";
import { toManagedLeaseRow } from "./managed-lease-row";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const MINUTE = 60_000;

const NAMES = {
  ...emptyResolvedNames(),
  cipherNameById: new Map([["cipher-1", "Prod database"]]),
  collectionNameById: new Map([["col-1", "Production"]]),
};

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    requesterId: "user-1",
    status: "approved",
    leaseNotBefore: "2026-08-18T09:00:00.000Z",
    leaseNotAfter: "2026-08-18T13:00:00.000Z",
    submittedAt: "2026-08-17T11:30:00.000Z",
    decisions: [],
    requesterName: "Grace",
    requesterEmail: "grace@example.com",
    ...overrides,
  } as unknown as AccessRequestView;
}

function pending() {
  return fromApprovalRow(
    toApprovalRow(request({ status: "pending" }), NAMES, NOW, true, "en-US"),
    NOW,
  );
}

function ready() {
  return fromUnstartedApproval(request(), NAMES, NOW, "en-US");
}

function active(endsAt: Date, extension?: { addedSeconds: number; latestEndMs: number }) {
  const lease = toManagedLeaseRow(
    request({
      producedLeaseId: "lease-1",
      producedLeaseStatus: "active",
      leaseNotBefore: "2026-08-17T11:00:00.000Z",
      leaseNotAfter: endsAt.toISOString(),
    }) as AccessRequestView & { producedLeaseId: AccessLeaseId },
    NAMES,
    extension,
  );
  return fromManagedLease(lease, NOW, "en-US");
}

describe("approver rows", () => {
  it("builds an unstarted approval with its names and search text", () => {
    const row = ready();

    expect(row).toMatchObject({
      kind: "ready",
      id: "req-1",
      cipherName: "Prod database",
      collectionName: "Production",
      requester: "Grace",
      duration: { key: "pamInboxDurationHours", value: 4 },
      searchText: "prod database production grace grace@example.com",
    });
  });

  it("reads a running lease's window off the lease, so an extension shows", () => {
    const extendedEnd = Date.parse("2026-08-17T16:00:00.000Z");

    const row = active(new Date("2026-08-17T14:00:00.000Z"), {
      addedSeconds: 7200,
      latestEndMs: extendedEnd,
    });

    expect(row.windowEndMs).toBe(extendedEnd);
    expect(row.duration).toEqual({ key: "pamInboxDurationHours", value: 5 });
    expect(row.windowRange.key).toBe("pamWindowUntil");
  });

  describe("approverRowStatus", () => {
    it("reads the stage for a pending or ready row", () => {
      expect(approverRowStatus(pending(), NOW.getTime())).toBe(ApproverRowStatus.Pending);
      expect(approverRowStatus(ready(), NOW.getTime())).toBe(ApproverRowStatus.Ready);
    });

    it("turns a running lease ending soon at the badge's five-minute cutoff", () => {
      const row = active(new Date(NOW.getTime() + 10 * MINUTE));

      expect(approverRowStatus(row, NOW.getTime())).toBe(ApproverRowStatus.InUse);
      expect(approverRowStatus(row, NOW.getTime() + 5 * MINUTE)).toBe(ApproverRowStatus.EndingSoon);
    });
  });

  it("badges a running lease with its countdown and the rest by stage", () => {
    const end = new Date(NOW.getTime() + 10 * MINUTE);

    expect(approverBadgeState(pending())).toEqual({ kind: "pending" });
    expect(approverBadgeState(ready())).toEqual({ kind: "ready" });
    expect(approverBadgeState(active(end))).toEqual({ kind: "active", expiresAt: end });
  });

  it("sorts by stage, then the soonest end", () => {
    const later = active(new Date(NOW.getTime() + 60 * MINUTE));
    const sooner = active(new Date(NOW.getTime() + 10 * MINUTE));

    expect(
      [later, ready(), sooner, pending()].sort(compareApproverStatus).map((row) => row.kind),
    ).toEqual(["pending", "ready", "active", "active"]);
    expect([later, sooner].sort(compareApproverStatus)).toEqual([sooner, later]);
  });
});
