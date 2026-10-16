import {
  durationLabel,
  exactWindow,
  reasonText,
  relativeStart,
  windowRange,
} from "./approval-window";

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

  it.each([
    ["just under an hour", "2024-01-01T00:59:50.000Z"],
    ["just over an hour", "2024-01-01T01:02:00.000Z"],
  ])("labels a window %s as 1 hour", (_label, leaseNotAfter) => {
    expect(durationLabel({ leaseNotBefore: "2024-01-01T00:00:00.000Z", leaseNotAfter })).toEqual({
      key: "pamInboxDuration1Hour",
      value: null,
    });
  });

  it("keeps one decimal for a fractional number of hours", () => {
    expect(
      durationLabel({
        leaseNotBefore: "2024-01-01T00:00:00.000Z",
        leaseNotAfter: "2024-01-01T01:30:00.000Z",
      }),
    ).toEqual({ key: "pamInboxDurationHours", value: 1.5 });
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
  it("formats both bounds", () => {
    const text = exactWindow(
      {
        leaseNotBefore: "2024-01-01T00:00:00.000Z",
        leaseNotAfter: "2024-01-01T01:00:00.000Z",
      },
      "en-US",
    );
    expect(text).toContain("–");
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("windowRange", () => {
  // Local date components, so the day boundaries hold in any timezone.
  const now = new Date(2024, 5, 15, 12, 0, 0);
  const format = (date: Date, options: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat(undefined, options).format(date);
  const window = (start: Date, end: Date) => ({
    leaseNotBefore: start.toISOString(),
    leaseNotAfter: end.toISOString(),
  });

  it("reads an open window as its end time when it ends today", () => {
    const end = new Date(2024, 5, 15, 20, 7, 0);

    expect(windowRange(window(new Date(2024, 5, 15, 11, 0, 0), end), now)).toEqual({
      key: "pamWindowUntil",
      values: [format(end, { hour: "numeric", minute: "2-digit" })],
    });
  });

  it("adds the date to an open window that ends on a later day", () => {
    const end = new Date(2024, 5, 17, 9, 0, 0);

    expect(windowRange(window(new Date(2024, 5, 15, 11, 0, 0), end), now)).toEqual({
      key: "pamWindowUntil",
      values: [
        `${format(end, { month: "short", day: "numeric" })}, ${format(end, { hour: "numeric" })}`,
      ],
    });
  });

  it("names tomorrow for a window that starts and ends tomorrow, dropping zero minutes", () => {
    const start = new Date(2024, 5, 16, 9, 0, 0);
    const end = new Date(2024, 5, 16, 13, 0, 0);

    expect(windowRange(window(start, end), now)).toEqual({
      key: "pamWindowTomorrowRange",
      values: [format(start, { hour: "numeric" }), format(end, { hour: "numeric" })],
    });
  });

  it("names today for a later window on the same day", () => {
    const start = new Date(2024, 5, 15, 14, 30, 0);
    const end = new Date(2024, 5, 15, 16, 0, 0);

    expect(windowRange(window(start, end), now).key).toBe("pamWindowTodayRange");
  });

  it("names the date for a single-day window further out", () => {
    const start = new Date(2024, 5, 20, 9, 0, 0);
    const end = new Date(2024, 5, 20, 10, 0, 0);

    expect(windowRange(window(start, end), now)).toEqual({
      key: "pamWindowSameDayRange",
      values: [
        format(start, { month: "short", day: "numeric" }),
        format(start, { hour: "numeric" }),
        format(end, { hour: "numeric" }),
      ],
    });
  });

  it("dates both ends of a future window spanning days", () => {
    const start = new Date(2024, 8, 30, 16, 12, 0);
    const end = new Date(2024, 9, 3, 16, 12, 0);
    const dateTime = (date: Date) =>
      `${format(date, { month: "short", day: "numeric" })}, ${format(date, { hour: "numeric", minute: "2-digit" })}`;

    expect(windowRange(window(start, end), now)).toEqual({
      key: "pamWindowRange",
      values: [dateTime(start), dateTime(end)],
    });
  });
});
