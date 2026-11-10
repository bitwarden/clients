import { durationText, exactWindow, reasonText, relativeStart } from "./approval-window";

describe("reasonText", () => {
  it("returns the trimmed reason", () => {
    expect(reasonText({ reason: "  Need prod access  " })).toBe("Need prod access");
  });

  it("returns null for a blank or missing reason", () => {
    expect(reasonText({ reason: "   " })).toBeNull();
    expect(reasonText({ reason: undefined })).toBeNull();
  });
});

describe("durationText", () => {
  const window = (leaseNotAfter: string) => ({
    leaseNotBefore: "2024-01-01T00:00:00.000Z",
    leaseNotAfter,
  });

  it("labels sub-hour windows in minutes", () => {
    expect(durationText(window("2024-01-01T00:30:00.000Z"), "en-US")).toBe("30 minutes");
  });

  it("labels a 1-hour window distinctly", () => {
    expect(durationText(window("2024-01-01T01:00:00.000Z"), "en-US")).toBe("1 hour");
  });

  it("labels multi-hour windows in hours", () => {
    expect(durationText(window("2024-01-01T04:00:00.000Z"), "en-US")).toBe("4 hours");
  });

  it("carries past a day rather than counting on in hours", () => {
    // The old hour-only label read this as "50 hours", which the My requests table never did.
    expect(durationText(window("2024-01-03T02:00:00.000Z"), "en-US")).toBe("2 days, 2 hours");
  });

  it("follows the caller's locale", () => {
    expect(durationText(window("2024-01-01T04:00:00.000Z"), "de-DE")).not.toBe("4 hours");
  });
});

describe("relativeStart", () => {
  // Built from local date components, not a fixed UTC instant, so day-boundary math is
  // exercised regardless of timezone.
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
  it("formats both bounds as timestamps", () => {
    const text = exactWindow(
      {
        leaseNotBefore: new Date(2024, 0, 1, 9, 0).toISOString(),
        leaseNotAfter: new Date(2024, 0, 1, 10, 30).toISOString(),
      },
      "en-US",
    );
    expect(text).toBe("Jan 1, 2024, 9:00 AM – Jan 1, 2024, 10:30 AM");
  });
});
