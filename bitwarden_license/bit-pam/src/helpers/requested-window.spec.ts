import { requestedWindowSeconds } from "./requested-window";

describe("requestedWindowSeconds", () => {
  it("returns the window length in seconds when both bounds are present", () => {
    expect(
      requestedWindowSeconds({
        leaseNotBefore: "2026-06-10T10:00:00Z",
        leaseNotAfter: "2026-06-10T11:00:00Z",
      }),
    ).toBe(3600);
  });

  it("supports sub-minute and fractional-hour spans", () => {
    expect(
      requestedWindowSeconds({
        leaseNotBefore: "2026-06-10T10:00:00Z",
        leaseNotAfter: "2026-06-10T10:00:10Z",
      }),
    ).toBe(10);
    expect(
      requestedWindowSeconds({
        leaseNotBefore: "2026-06-10T10:00:00Z",
        leaseNotAfter: "2026-06-10T11:30:00Z",
      }),
    ).toBe(5400);
  });

  it("returns null when either bound is missing", () => {
    expect(
      requestedWindowSeconds({
        leaseNotBefore: null,
        leaseNotAfter: "2026-06-10T11:00:00Z",
      }),
    ).toBeNull();
    expect(
      requestedWindowSeconds({
        leaseNotBefore: "2026-06-10T10:00:00Z",
        leaseNotAfter: null,
      }),
    ).toBeNull();
    expect(requestedWindowSeconds({ leaseNotBefore: null, leaseNotAfter: null })).toBeNull();
  });
});
