import { requestedWindowSeconds } from "./requested-window";

describe("requestedWindowSeconds", () => {
  it("returns the window length in seconds", () => {
    expect(
      requestedWindowSeconds({
        leaseNotBefore: "2024-01-01T00:00:00.000Z",
        leaseNotAfter: "2024-01-01T01:00:00.000Z",
      }),
    ).toBe(3600);
  });

  it("returns the bump length for an extension's before/after bounds", () => {
    expect(
      requestedWindowSeconds({
        leaseNotBefore: "2024-01-01T01:00:00.000Z",
        leaseNotAfter: "2024-01-01T03:00:00.000Z",
      }),
    ).toBe(7200);
  });
});
