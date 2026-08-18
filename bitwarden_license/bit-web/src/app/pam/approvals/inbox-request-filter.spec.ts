import { isActionableInboxRequest } from "./inbox-request-filter";

const NOW = new Date("2026-08-17T12:00:00.000Z");

// `expiredAt` is spelled out on every fixture because the SDK maps Rust's `Option<DateTime<Utc>>`
// to a required `expiredAt: DateTime<Utc> | undefined` rather than an optional property, so a
// request view always carries the key.

describe("isActionableInboxRequest", () => {
  it("keeps a request whose window is still open", () => {
    expect(
      isActionableInboxRequest(
        { leaseNotAfter: "2026-08-17T13:00:00.000Z", expiredAt: undefined },
        NOW,
      ),
    ).toBe(true);
  });

  it("drops a request whose window has fully elapsed", () => {
    // Approving it would grant nothing, so it belongs in history, not the decision queue.
    expect(
      isActionableInboxRequest(
        { leaseNotAfter: "2026-08-17T11:00:00.000Z", expiredAt: undefined },
        NOW,
      ),
    ).toBe(false);
  });

  it("drops a request whose window closes exactly now", () => {
    expect(
      isActionableInboxRequest({ leaseNotAfter: NOW.toISOString(), expiredAt: undefined }, NOW),
    ).toBe(false);
  });

  it("drops a request the server marked lapsed, even with time left on the window", () => {
    expect(
      isActionableInboxRequest(
        { leaseNotAfter: "2026-08-17T13:00:00.000Z", expiredAt: "2026-08-17T11:30:00.000Z" },
        NOW,
      ),
    ).toBe(false);
  });
});
