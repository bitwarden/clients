import type {
  AccessLeaseView,
  AccessRequestStatus,
  AccessRequestView,
} from "../abstractions/access-lease";
import { ENDING_SOON_THRESHOLD_MS } from "../access-state-badge/access-badge-state";

import {
  diffPamState,
  emptyPamSnapshot,
  nextLeaseBoundaryMs,
  PamNotificationInput,
  PamNotificationSnapshot,
} from "./pam-notification-diff";

const NOW = new Date("2026-06-10T12:00:00.000Z");
const ME = "me";
const ISO = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
const HOUR = 60 * 60 * 1000;

function request(
  id: string,
  init: { status?: AccessRequestStatus; requesterId?: string; notAfterMs?: number } = {},
): AccessRequestView {
  return {
    id,
    requesterId: init.requesterId ?? ME,
    status: init.status ?? "pending",
    leaseNotAfter: ISO(init.notAfterMs ?? HOUR),
  } as unknown as AccessRequestView;
}

function lease(id: string, init: { notAfterMs?: number; status?: string } = {}): AccessLeaseView {
  return {
    id,
    status: init.status ?? "active",
    notAfter: ISO(init.notAfterMs ?? HOUR),
  } as unknown as AccessLeaseView;
}

function input(init: Partial<PamNotificationInput> = {}): PamNotificationInput {
  return { userId: ME, inbox: [], requests: [], leases: [], ...init };
}

function snapshot(init: Partial<PamNotificationSnapshot> = {}): PamNotificationSnapshot {
  return { ...emptyPamSnapshot(), ...init };
}

describe("diffPamState", () => {
  describe("seeding", () => {
    it("reports nothing on the first read but records what it saw", () => {
      const result = diffPamState(
        null,
        input({
          inbox: [request("i1", { requesterId: "other" })],
          requests: [request("r1", { status: "approved" })],
          leases: [lease("l1"), lease("l2", { notAfterMs: 60_000 })],
        }),
        NOW,
      );

      expect(result.events).toEqual([]);
      expect(result.snapshot).toEqual({
        inbox: ["i1"],
        requests: { r1: "approved" },
        leases: { l1: "live", l2: "endingSoon" },
      });
    });

    it("stays silent for what the seed already held on the next read", () => {
      const seeded = diffPamState(
        null,
        input({ inbox: [request("i1", { requesterId: "other" })] }),
        NOW,
      ).snapshot;

      const result = diffPamState(
        seeded,
        input({ inbox: [request("i1", { requesterId: "other" })] }),
        NOW,
      );

      expect(result.events).toEqual([]);
    });
  });

  describe("approver inbox", () => {
    it("reports a new actionable request from someone else", () => {
      const result = diffPamState(
        snapshot({ inbox: ["i1"] }),
        input({
          inbox: [request("i1", { requesterId: "other" }), request("i2", { requesterId: "other" })],
        }),
        NOW,
      );

      expect(result.events).toEqual([{ kind: "approvalRequested", id: "i2" }]);
      expect(result.snapshot.inbox).toEqual(["i1", "i2"]);
    });

    it("ignores a request the user authored themselves", () => {
      const result = diffPamState(
        snapshot(),
        input({ inbox: [request("i1", { requesterId: ME })] }),
        NOW,
      );

      expect(result.events).toEqual([]);
      expect(result.snapshot.inbox).toEqual([]);
    });

    it("ignores a request whose window has already closed", () => {
      const result = diffPamState(
        snapshot(),
        input({ inbox: [request("i1", { requesterId: "other", notAfterMs: -1 })] }),
        NOW,
      );

      expect(result.events).toEqual([]);
    });

    it("does not report a request that left and came back as new twice", () => {
      const first = diffPamState(
        snapshot(),
        input({ inbox: [request("i1", { requesterId: "other" })] }),
        NOW,
      );
      const second = diffPamState(
        first.snapshot,
        input({ inbox: [request("i1", { requesterId: "other" })] }),
        NOW,
      );

      expect(first.events).toHaveLength(1);
      expect(second.events).toEqual([]);
    });
  });

  describe("own requests", () => {
    it.each([
      ["approved", "requestApproved"],
      ["denied", "requestDenied"],
      ["canceled", "requestCanceled"],
    ] as const)("reports a pending request that became %s", (status, kind) => {
      const result = diffPamState(
        snapshot({ requests: { r1: "pending" } }),
        input({ requests: [request("r1", { status })] }),
        NOW,
      );

      expect(result.events).toEqual([{ kind, id: "r1" }]);
    });

    it("reports an approval withdrawn into a denial", () => {
      const result = diffPamState(
        snapshot({ requests: { r1: "approved" } }),
        input({ requests: [request("r1", { status: "denied" })] }),
        NOW,
      );

      expect(result.events).toEqual([{ kind: "requestDenied", id: "r1" }]);
    });

    it("does not repeat a decision already recorded", () => {
      const result = diffPamState(
        snapshot({ requests: { r1: "approved" } }),
        input({ requests: [request("r1", { status: "approved" })] }),
        NOW,
      );

      expect(result.events).toEqual([]);
    });

    it("is silent when a pending request merely expires", () => {
      const result = diffPamState(
        snapshot({ requests: { r1: "pending" } }),
        input({ requests: [request("r1", { status: "expired" })] }),
        NOW,
      );

      expect(result.events).toEqual([]);
    });

    it("is silent for a request first seen already decided", () => {
      const result = diffPamState(
        snapshot(),
        input({ requests: [request("r1", { status: "approved" })] }),
        NOW,
      );

      expect(result.events).toEqual([]);
      expect(result.snapshot.requests).toEqual({ r1: "approved" });
    });
  });

  describe("leases", () => {
    it("reports a lease entering its ending-soon window once", () => {
      const soon = lease("l1", { notAfterMs: ENDING_SOON_THRESHOLD_MS - 1000 });

      const first = diffPamState(
        snapshot({ leases: { l1: "live" } }),
        input({ leases: [soon] }),
        NOW,
      );
      const second = diffPamState(first.snapshot, input({ leases: [soon] }), NOW);

      expect(first.events).toEqual([{ kind: "leaseEndingSoon", id: "l1" }]);
      expect(second.events).toEqual([]);
    });

    it("reports a lease that ended by time", () => {
      const result = diffPamState(
        snapshot({ leases: { l1: "endingSoon" } }),
        input({ leases: [lease("l1", { notAfterMs: -1 })] }),
        NOW,
      );

      expect(result.events).toEqual([{ kind: "leaseEnded", id: "l1" }]);
      expect(result.snapshot.leases).toEqual({});
    });

    it("reports a lease that is revoked or gone from the list as ended", () => {
      const revoked = diffPamState(
        snapshot({ leases: { l1: "live" } }),
        input({ leases: [lease("l1", { status: "revoked" })] }),
        NOW,
      );
      const gone = diffPamState(snapshot({ leases: { l1: "live" } }), input({ leases: [] }), NOW);

      expect(revoked.events).toEqual([{ kind: "leaseEnded", id: "l1" }]);
      expect(gone.events).toEqual([{ kind: "leaseEnded", id: "l1" }]);
    });

    it("warns again when an extension is followed by a new ending-soon window", () => {
      const extended = diffPamState(
        snapshot({ leases: { l1: "endingSoon" } }),
        input({ leases: [lease("l1")] }),
        NOW,
      );
      const again = diffPamState(
        extended.snapshot,
        input({ leases: [lease("l1", { notAfterMs: 1000 })] }),
        NOW,
      );

      expect(extended.events).toEqual([]);
      expect(again.events).toEqual([{ kind: "leaseEndingSoon", id: "l1" }]);
    });

    it("is silent for a lease first seen already ending", () => {
      const result = diffPamState(
        snapshot(),
        input({ leases: [lease("l1", { notAfterMs: 1000 })] }),
        NOW,
      );

      expect(result.events).toEqual([]);
      expect(result.snapshot.leases).toEqual({ l1: "endingSoon" });
    });

    it("treats an unparseable end as already ended", () => {
      const broken = { id: "l1", status: "active", notAfter: "nope" } as unknown as AccessLeaseView;

      const result = diffPamState(
        snapshot({ leases: { l1: "live" } }),
        input({ leases: [broken] }),
        NOW,
      );

      expect(result.events).toEqual([{ kind: "leaseEnded", id: "l1" }]);
    });
  });

  describe("a failed read", () => {
    it("carries that slice over and reports nothing from it", () => {
      const prev = snapshot({
        inbox: ["i1"],
        requests: { r1: "pending" },
        leases: { l1: "live" },
      });

      const result = diffPamState(
        prev,
        { userId: ME, inbox: null, requests: null, leases: null },
        NOW,
      );

      expect(result.events).toEqual([]);
      expect(result.snapshot).toEqual(prev);
    });

    it("still reports from the lists that did load", () => {
      const result = diffPamState(
        snapshot({ requests: { r1: "pending" }, leases: { l1: "live" } }),
        { userId: ME, inbox: null, requests: [request("r1", { status: "denied" })], leases: null },
        NOW,
      );

      expect(result.events).toEqual([{ kind: "requestDenied", id: "r1" }]);
      expect(result.snapshot.leases).toEqual({ l1: "live" });
    });
  });

  it("carries only ids and statuses in the snapshot", () => {
    const withText = { ...request("r1"), reason: "secret reason", requesterName: "Ada" };

    const result = diffPamState(null, input({ requests: [withText] }), NOW);

    expect(JSON.stringify(result.snapshot)).not.toContain("secret reason");
    expect(JSON.stringify(result.snapshot)).not.toContain("Ada");
  });
});

describe("nextLeaseBoundaryMs", () => {
  it("is the ending-soon moment of a live lease and the end of an ending one", () => {
    const leases = [lease("l1", { notAfterMs: HOUR }), lease("l2", { notAfterMs: 2 * HOUR })];

    expect(
      nextLeaseBoundaryMs(snapshot({ leases: { l1: "live", l2: "live" } }), leases, NOW.getTime()),
    ).toBe(NOW.getTime() + HOUR - ENDING_SOON_THRESHOLD_MS);
    expect(
      nextLeaseBoundaryMs(
        snapshot({ leases: { l1: "endingSoon", l2: "live" } }),
        leases,
        NOW.getTime(),
      ),
    ).toBe(NOW.getTime() + HOUR);
  });

  it("is undefined with no leases still open", () => {
    expect(nextLeaseBoundaryMs(snapshot(), [lease("l1")], NOW.getTime())).toBeUndefined();
  });
});
