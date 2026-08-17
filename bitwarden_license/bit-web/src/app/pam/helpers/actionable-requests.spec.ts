import type { AccessRequestStatus, AccessRequestView } from "../abstractions/access-lease";

import { actionableRequestCount, isActionableRequest } from "./actionable-requests";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const FUTURE = "2026-08-17T13:00:00.000Z";
const PAST = "2026-08-17T11:00:00.000Z";

function request(
  status: AccessRequestStatus,
  leaseNotAfter: string,
): Pick<AccessRequestView, "status" | "leaseNotAfter"> {
  return { status, leaseNotAfter };
}

describe("isActionableRequest", () => {
  it("counts a pending request regardless of its window", () => {
    expect(isActionableRequest(request("pending", PAST), NOW)).toBe(true);
    expect(isActionableRequest(request("pending", FUTURE), NOW)).toBe(true);
  });

  it("counts an approved request whose window is still open", () => {
    expect(isActionableRequest(request("approved", FUTURE), NOW)).toBe(true);
  });

  it("does not count an approved request whose window has lapsed", () => {
    // The server rejects activating it, so badging it would point at something unusable.
    expect(isActionableRequest(request("approved", PAST), NOW)).toBe(false);
  });

  it("does not count an approved request whose window closes exactly now", () => {
    expect(isActionableRequest(request("approved", NOW.toISOString()), NOW)).toBe(false);
  });

  it.each<AccessRequestStatus>(["activated", "denied", "canceled", "expired", "unknown"])(
    "does not count a %s request",
    (status) => {
      expect(isActionableRequest(request(status, FUTURE), NOW)).toBe(false);
    },
  );
});

describe("actionableRequestCount", () => {
  it("counts only the actionable requests", () => {
    const requests = [
      request("pending", FUTURE),
      request("approved", FUTURE),
      request("approved", PAST),
      request("activated", FUTURE),
      request("denied", FUTURE),
    ];

    expect(actionableRequestCount(requests, NOW)).toBe(2);
  });

  it("is zero for an empty list", () => {
    expect(actionableRequestCount([], NOW)).toBe(0);
  });
});
