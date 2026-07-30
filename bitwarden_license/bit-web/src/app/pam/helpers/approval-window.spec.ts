import { durationLabel, exactWindow, reasonText, relativeStart } from "./approval-window";

describe("reasonText", () => {
  it("returns the trimmed reason", () => {
    expect(reasonText({ reason: "  Need prod access  " })).toBe("Need prod access");
  });

  it("returns null for a blank or missing reason", () => {
    expect(reasonText({ reason: "   " })).toBeNull();
    expect(reasonText({ reason: undefined })).toBeNull();
  });
});

describe("durationLabel", () => {
  it("labels sub-hour windows in minutes", () => {
    expect(
      durationLabel({
        leaseNotBefore: "2024-01-01T00:00:00.000Z",
        leaseNotAfter: "2024-01-01T00:30:00.000Z",
      }),
    ).toEqual({ key: "pamInboxDurationMinutes", value: 30 });
  });

  it("labels a 1-hour window distinctly", () => {
    expect(
      durationLabel({
        leaseNotBefore: "2024-01-01T00:00:00.000Z",
        leaseNotAfter: "2024-01-01T01:00:00.000Z",
      }),
    ).toEqual({ key: "pamInboxDuration1Hour", value: null });
  });

  it("labels multi-hour windows in hours", () => {
    expect(
      durationLabel({
        leaseNotBefore: "2024-01-01T00:00:00.000Z",
        leaseNotAfter: "2024-01-01T04:00:00.000Z",
      }),
    ).toEqual({ key: "pamInboxDurationHours", value: 4 });
  });
});

describe("relativeStart", () => {
  // Built from local date components (not a fixed UTC instant) so the day-boundary math — which
  // `relativeStart` itself does in local time — is exercised the same way regardless of the
  // timezone the test runs in.
  const now = new Date(2024, 5, 15, 12, 0, 0);

  it("returns starting-now when the window has already opened", () => {
    const start = new Date(2024, 5, 15, 11, 0, 0);
    expect(relativeStart({ leaseNotBefore: start.toISOString() }, now)).toEqual({
      key: "pamInboxStartAsap",
      value: null,
    });
  });

  it("returns today for a same-day future start", () => {
    const start = new Date(2024, 5, 15, 23, 0, 0);
    expect(relativeStart({ leaseNotBefore: start.toISOString() }, now)).toEqual({
      key: "pamInboxStartToday",
      value: null,
    });
  });

  it("returns tomorrow for a next-day start", () => {
    const start = new Date(2024, 5, 16, 8, 0, 0);
    expect(relativeStart({ leaseNotBefore: start.toISOString() }, now)).toEqual({
      key: "pamInboxStartTomorrow",
      value: null,
    });
  });

  it("returns an in-N-days label for a further-out start", () => {
    const start = new Date(2024, 5, 20, 8, 0, 0);
    expect(relativeStart({ leaseNotBefore: start.toISOString() }, now)).toEqual({
      key: "pamInboxStartInDays",
      value: 5,
    });
  });
});

describe("exactWindow", () => {
  it("formats both bounds", () => {
    const text = exactWindow({
      leaseNotBefore: "2024-01-01T00:00:00.000Z",
      leaseNotAfter: "2024-01-01T01:00:00.000Z",
    });
    expect(text).toContain("–");
    expect(text.length).toBeGreaterThan(0);
  });
});
