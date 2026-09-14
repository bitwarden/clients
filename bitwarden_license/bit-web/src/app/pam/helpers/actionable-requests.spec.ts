import type { AccessRequestStatus, AccessRequestView } from "../abstractions/access-lease";

import { isActionableRequest } from "./actionable-requests";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const FUTURE = "2026-08-17T13:00:00.000Z";
const PAST = "2026-08-17T11:00:00.000Z";

type TestRequest = Pick<AccessRequestView, "status" | "leaseNotAfter" | "producedLeaseId">;

function request(status: AccessRequestStatus, leaseNotAfter: string, producedLeaseId?: string) {
  return { status, leaseNotAfter, producedLeaseId } as unknown as TestRequest;
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
    // The server rejects activating it, so badging it would point at something unusable.
    expect(isActionableRequest(request("approved", PAST), NOW)).toBe(false);
  });

  it("does not count an approved request whose window closes exactly now", () => {
    expect(isActionableRequest(request("approved", NOW.toISOString()), NOW)).toBe(false);
  });

  it.each<AccessRequestStatus>(["denied", "canceled", "expired", "unknown"])(
    "does not count a %s request",
    (status) => {
      expect(isActionableRequest(request(status, FUTURE), NOW)).toBe(false);
    },
  );
});
