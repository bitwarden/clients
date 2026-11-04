import type { AccessRequestStatus, AccessRequestView } from "../abstractions/access-lease";

import { isActionableRequest } from "./actionable-requests";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const FUTURE = "2026-08-17T13:00:00.000Z";
const PAST = "2026-08-17T11:00:00.000Z";

type TestRequest = Pick<
  AccessRequestView,
  "status" | "leaseNotAfter" | "producedLeaseId" | "extensionOfLeaseId"
>;

function request(
  status: AccessRequestStatus,
  leaseNotAfter: string,
  producedLeaseId?: string,
  extensionOfLeaseId?: string,
) {
  return { status, leaseNotAfter, producedLeaseId, extensionOfLeaseId } as unknown as TestRequest;
}

describe("isActionableRequest", () => {
  it("counts a pending request regardless of its window", () => {
    expect(isActionableRequest(request("pending", PAST), NOW)).toBe(true);
    expect(isActionableRequest(request("pending", FUTURE), NOW)).toBe(true);
  });

  it("counts an approved request whose window is still open", () => {
    expect(isActionableRequest(request("approved", FUTURE), NOW)).toBe(true);
  });

  it("does not count an approved request that has already been activated", () => {
    // Activation leaves the status `approved`; the lease it minted is what marks it started.
    expect(isActionableRequest(request("approved", FUTURE, "lease-1"), NOW)).toBe(false);
  });

  it("does not count an approved request whose window has lapsed", () => {
    expect(isActionableRequest(request("approved", PAST), NOW)).toBe(false);
  });

  it("does not count an approved request whose window closes exactly now", () => {
    expect(isActionableRequest(request("approved", NOW.toISOString()), NOW)).toBe(false);
  });

  it("does not count an approved extension, which mints no lease of its own", () => {
    // PAM-408: it never gains a `producedLeaseId`, so it once counted until its window closed,
    // including after the extended lease was ended.
    expect(isActionableRequest(request("approved", FUTURE, undefined, "lease-1"), NOW)).toBe(false);
  });

  it("counts a pending extension, which still awaits a decision", () => {
    expect(isActionableRequest(request("pending", FUTURE, undefined, "lease-1"), NOW)).toBe(true);
  });

  it.each<AccessRequestStatus>(["denied", "canceled", "expired", "unknown"])(
    "does not count a %s request",
    (status) => {
      expect(isActionableRequest(request(status, FUTURE), NOW)).toBe(false);
    },
  );
});
