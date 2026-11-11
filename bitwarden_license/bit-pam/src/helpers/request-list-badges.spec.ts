import type { AccessRequestView } from "../abstractions/access-lease";

import { badgesFromMyRequests, nextRequestListChangeMs } from "./request-list-badges";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

function request(fields: Partial<AccessRequestView>): AccessRequestView {
  return {
    cipherId: "cipher-1",
    status: "pending",
    leaseNotAfter: at(60),
    producedLeaseId: undefined,
    producedLeaseStatus: undefined,
    producedLeaseNotAfter: undefined,
    extensionOfLeaseId: undefined,
    ...fields,
  } as unknown as AccessRequestView;
}

const activated = (leaseEnd: string) =>
  request({
    status: "approved",
    producedLeaseId: "lease-1",
    producedLeaseStatus: "active",
    producedLeaseNotAfter: leaseEnd,
  } as Partial<AccessRequestView>);

describe("badgesFromMyRequests", () => {
  it("gives active with the lease's current end, which an extension moves past the window", () => {
    const badges = badgesFromMyRequests([{ ...activated(at(90)), leaseNotAfter: at(30) }], NOW);

    expect(badges.get("cipher-1")).toEqual({ kind: "active", expiresAt: new Date(at(90)) });
  });

  it("gives ready for an approved request that has not produced a lease", () => {
    const badges = badgesFromMyRequests([request({ status: "approved" })], NOW);

    expect(badges.get("cipher-1")).toEqual({ kind: "ready" });
  });

  it("gives pending for an open request", () => {
    expect(badgesFromMyRequests([request({})], NOW).get("cipher-1")).toEqual({ kind: "pending" });
  });

  it("ranks active over ready over pending on one cipher, whatever the order", () => {
    const pending = request({});
    const ready = request({ status: "approved" });

    expect(badgesFromMyRequests([pending, ready], NOW).get("cipher-1")?.kind).toBe("ready");
    expect(
      badgesFromMyRequests([ready, activated(at(90)), pending], NOW).get("cipher-1")?.kind,
    ).toBe("active");
  });

  it.each([
    ["a lease that has ended", activated(at(-1))],
    ["a lease an approver revoked", { ...activated(at(90)), producedLeaseStatus: "revoked" }],
    ["an approval whose window has ended", request({ status: "approved", leaseNotAfter: at(-1) })],
    ["an open request whose window has ended", request({ leaseNotAfter: at(-1) })],
    [
      "an approved extension, which never produces a lease of its own",
      request({ status: "approved", extensionOfLeaseId: "lease-1" } as Partial<AccessRequestView>),
    ],
    ["a denied request", request({ status: "denied" })],
    ["a canceled request", request({ status: "canceled" })],
  ])("gives nothing for %s", (_, item) => {
    expect(badgesFromMyRequests([item as AccessRequestView], NOW).size).toBe(0);
  });

  it("keys each badge by its own cipher", () => {
    const badges = badgesFromMyRequests(
      [
        request({ cipherId: "a" } as Partial<AccessRequestView>),
        request({ cipherId: "b", status: "approved" } as Partial<AccessRequestView>),
      ],
      NOW,
    );

    expect([...badges]).toEqual([
      ["a", { kind: "pending" }],
      ["b", { kind: "ready" }],
    ]);
  });
});

describe("nextRequestListChangeMs", () => {
  it("is the earliest end among the requests that give a badge", () => {
    const next = nextRequestListChangeMs(
      [
        request({ leaseNotAfter: at(45) }),
        activated(at(20)),
        request({ status: "approved", leaseNotAfter: at(30) }),
      ],
      NOW,
    );

    expect(next).toBe(Date.parse(at(20)));
  });

  it("ignores requests that give no badge, such as a denial with a window still ahead", () => {
    expect(
      nextRequestListChangeMs([request({ status: "denied", leaseNotAfter: at(5) })], NOW),
    ).toBe(undefined);
  });

  it("is undefined without a request that gives a badge", () => {
    expect(nextRequestListChangeMs([], NOW)).toBeUndefined();
  });
});
