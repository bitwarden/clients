import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";

import { isActionableInboxRequest } from "./inbox-request-filter";

const NOW = new Date("2026-06-15T12:00:00Z");

function request(
  overrides: Partial<Pick<AccessRequestDetailsResponse, "requestedNotAfter" | "expiredAt">>,
): Pick<AccessRequestDetailsResponse, "requestedNotAfter" | "expiredAt"> {
  return { requestedNotAfter: null, expiredAt: null, ...overrides };
}

describe("isActionableInboxRequest", () => {
  it("keeps a request with no window end and no expiry", () => {
    expect(isActionableInboxRequest(request({}), NOW)).toBe(true);
  });

  it("keeps a request whose window has not yet elapsed", () => {
    expect(
      isActionableInboxRequest(request({ requestedNotAfter: "2026-06-15T13:00:00Z" }), NOW),
    ).toBe(true);
  });

  it("drops a request whose window has fully elapsed (timed out)", () => {
    expect(
      isActionableInboxRequest(request({ requestedNotAfter: "2026-06-15T11:00:00Z" }), NOW),
    ).toBe(false);
  });

  it("drops a request at the exact window boundary", () => {
    expect(
      isActionableInboxRequest(request({ requestedNotAfter: "2026-06-15T12:00:00Z" }), NOW),
    ).toBe(false);
  });

  it("drops a request the server marked as lapsed, even with a future window", () => {
    expect(
      isActionableInboxRequest(
        request({ requestedNotAfter: "2026-06-15T13:00:00Z", expiredAt: "2026-06-15T11:30:00Z" }),
        NOW,
      ),
    ).toBe(false);
  });
});
