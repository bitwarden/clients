import {
  type RequestWindowFormValue,
  composeRequestWindow,
  defaultRequestWindow,
  requestWindowProblem,
  startTimeSlots,
  toDateInputValue,
  toTimeInputValue,
  windowEndAt,
} from "./request-access-window";

/**
 * Pinned, since `requestWindowProblem` rejects an ended window and the literal dates below would
 * eventually fail against the real clock.
 */
const NOW = new Date("2026-08-17T08:00");

const WEEK_SECONDS = 7 * 24 * 60 * 60;

const problemAt = (value: RequestWindowFormValue, maxWindowSeconds: number = WEEK_SECONDS) =>
  requestWindowProblem(value, maxWindowSeconds, NOW);

const sameDay = (date: string, startTime: string, endTime: string): RequestWindowFormValue => ({
  startDate: date,
  startTime,
  endDate: date,
  endTime,
});

describe("composeRequestWindow", () => {
  it("composes the dates and times into a local-time window", () => {
    const window = composeRequestWindow(sameDay("2026-08-17", "09:30", "11:00"));

    expect(window).toEqual({
      start: new Date("2026-08-17T09:30"),
      end: new Date("2026-08-17T11:00"),
    });
  });

  it("composes a window spanning several days", () => {
    const window = composeRequestWindow({
      startDate: "2026-08-17",
      startTime: "09:30",
      endDate: "2026-08-20",
      endTime: "17:00",
    });

    expect(window).toEqual({
      start: new Date("2026-08-17T09:30"),
      end: new Date("2026-08-20T17:00"),
    });
  });

  it("leaves an end earlier than the start alone, for the validator to refuse", () => {
    const window = composeRequestWindow(sameDay("2026-08-17", "23:00", "01:00"));

    expect(window!.end).toEqual(new Date("2026-08-17T01:00"));
  });

  it.each([
    ["a blank start date", { ...sameDay("2026-08-17", "09:30", "11:00"), startDate: "" }],
    ["a blank start time", sameDay("2026-08-17", "", "11:00")],
    ["a blank end date", { ...sameDay("2026-08-17", "09:30", "11:00"), endDate: "" }],
    ["a blank end time", sameDay("2026-08-17", "09:30", "")],
    ["null fields", { startDate: null, startTime: null, endDate: null, endTime: null }],
    ["absent fields", {}],
  ])("returns null for %s", (_label, value) => {
    expect(composeRequestWindow(value)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(composeRequestWindow(sameDay("not-a-date", "09:30", "11:00"))).toBeNull();
  });
});

describe("requestWindowProblem", () => {
  it("accepts a window whose end is after its start", () => {
    expect(problemAt(sameDay("2026-08-17", "09:00", "10:00"))).toBeNull();
  });

  it("stays quiet while the window is incomplete", () => {
    expect(problemAt(sameDay("2026-08-17", "09:00", ""))).toBeNull();
  });

  it("accepts a window crossing midnight onto the next date", () => {
    expect(
      problemAt({
        startDate: "2026-08-17",
        startTime: "23:00",
        endDate: "2026-08-18",
        endTime: "01:00",
      }),
    ).toBeNull();
  });

  it("rejects an end equal to the start", () => {
    expect(problemAt(sameDay("2026-08-17", "10:00", "10:00"))).toBe("endNotAfterStart");
  });

  it("rejects an end before the start", () => {
    expect(problemAt(sameDay("2026-08-17", "23:00", "01:00"))).toBe("endNotAfterStart");
    expect(
      problemAt({
        startDate: "2026-08-18",
        startTime: "09:00",
        endDate: "2026-08-17",
        endTime: "10:00",
      }),
    ).toBe("endNotAfterStart");
  });

  it("measures a multi-day window against the per-rule maximum", () => {
    const window = {
      startDate: "2026-08-17",
      startTime: "09:00",
      endDate: "2026-08-19",
      endTime: "09:00",
    };

    expect(problemAt(window, 2 * 24 * 60 * 60)).toBeNull();
    expect(problemAt(window, 24 * 60 * 60)).toBe("exceedsMaxWindow");
  });

  it("accepts a window exactly at an explicit per-rule maximum", () => {
    expect(problemAt(sameDay("2026-08-17", "09:00", "09:30"), 30 * 60)).toBeNull();
  });

  it("reports an inverted window before checking the per-rule maximum", () => {
    expect(problemAt(sameDay("2026-08-17", "11:00", "11:00"), 30 * 60)).toBe("endNotAfterStart");
  });

  it("rejects a window that has already ended", () => {
    expect(problemAt(sameDay("2026-08-09", "07:00", "08:00"))).toBe("endInPast");
  });

  it("rejects a past window on today's date too — the date alone is not the test", () => {
    expect(problemAt(sameDay("2026-08-17", "06:00", "07:00"))).toBe("endInPast");
  });

  it("rejects a window ending exactly now", () => {
    expect(problemAt(sameDay("2026-08-17", "07:00", "08:00"))).toBe("endInPast");
  });

  it("accepts a window already under way", () => {
    expect(problemAt(sameDay("2026-08-17", "07:00", "09:00"))).toBeNull();
  });

  it("reports an inverted window before a past one", () => {
    expect(problemAt(sameDay("2026-08-09", "08:00", "08:00"))).toBe("endNotAfterStart");
  });

  it("reports a past window before an over-long one", () => {
    expect(problemAt(sameDay("2026-08-09", "06:00", "08:00"), 30 * 60)).toBe("endInPast");
  });

  it("measures against the real clock when no instant is given", () => {
    expect(requestWindowProblem(sameDay("2020-01-01", "09:00", "10:00"), WEEK_SECONDS)).toBe(
      "endInPast",
    );
  });
});

describe("defaultRequestWindow", () => {
  it("seeds a window starting now and running the requested duration", () => {
    const now = new Date(2026, 7, 17, 9, 15, 0);

    expect(defaultRequestWindow(now, 3600)).toEqual(sameDay("2026-08-17", "09:15", "10:15"));
  });

  it("seeds the end on the next date when the duration crosses midnight", () => {
    const now = new Date(2026, 7, 17, 23, 30, 0);

    expect(defaultRequestWindow(now, 3600)).toEqual({
      startDate: "2026-08-17",
      startTime: "23:30",
      endDate: "2026-08-18",
      endTime: "00:30",
    });
  });

  it("seeds a multi-day rule default in full", () => {
    const now = new Date(2026, 7, 17, 9, 15, 0);

    expect(defaultRequestWindow(now, 3 * 24 * 60 * 60)).toEqual({
      startDate: "2026-08-17",
      startTime: "09:15",
      endDate: "2026-08-20",
      endTime: "09:15",
    });
  });

  it("seeds at least a minute for a sub-minute duration", () => {
    const now = new Date(2026, 7, 17, 9, 15, 0);

    expect(defaultRequestWindow(now, 10)).toEqual(sameDay("2026-08-17", "09:15", "09:16"));
  });

  it.each([
    ["a mid-morning open", new Date(2026, 7, 17, 9, 15, 0), 3600],
    ["an open close to midnight", new Date(2026, 7, 17, 23, 30, 0), 3600],
    ["a rule defaulting to a full day", new Date(2026, 7, 17, 9, 15, 0), 86400],
    ["a rule defaulting to several days", new Date(2026, 7, 17, 9, 15, 0), 3 * 86400],
    ["a rule defaulting to seconds", new Date(2026, 7, 17, 9, 15, 59), 10],
  ])("seeds a window the validator accepts on %s", (_label, now, duration) => {
    expect(requestWindowProblem(defaultRequestWindow(now, duration), WEEK_SECONDS, now)).toBeNull();
  });
});

describe("toDateInputValue / toTimeInputValue", () => {
  it("zero-pads month, day, hour and minute", () => {
    const date = new Date(2026, 0, 5, 7, 8, 0);

    expect(toDateInputValue(date)).toBe("2026-01-05");
    expect(toTimeInputValue(date)).toBe("07:08");
  });
});

describe("startTimeSlots", () => {
  it("offers now and each half hour after it today", () => {
    const slots = startTimeSlots("2026-08-17", new Date(2026, 7, 17, 22, 14, 0));

    expect(slots).toEqual(["22:14", "22:30", "23:00", "23:30"]);
  });

  it("does not repeat now when it falls on a half hour", () => {
    expect(startTimeSlots("2026-08-17", new Date(2026, 7, 17, 23, 0, 0))).toEqual([
      "23:00",
      "23:30",
    ]);
  });

  it("offers the whole day on a later date", () => {
    const slots = startTimeSlots("2026-08-18", new Date(2026, 7, 17, 22, 14, 0));

    expect(slots).toHaveLength(48);
    expect(slots[0]).toBe("00:00");
    expect(slots[47]).toBe("23:30");
  });
});

describe("windowEndAt", () => {
  it("adds the duration to the local start", () => {
    expect(windowEndAt("2026-08-17", "23:30", 3 * 3600)).toEqual(new Date(2026, 7, 18, 2, 30));
  });

  it.each([
    ["a blank date", "", "09:00"],
    ["a blank time", "2026-08-17", ""],
    ["an unparseable date", "not-a-date", "09:00"],
  ])("returns null for %s", (_label, date, time) => {
    expect(windowEndAt(date, time, 3600)).toBeNull();
  });
});
