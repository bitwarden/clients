import {
  MAX_REQUEST_ACCESS_WINDOW_SECONDS,
  composeRequestWindow,
  defaultRequestWindow,
  requestWindowProblem,
  toDateInputValue,
  toTimeInputValue,
} from "./request-access-window";

describe("composeRequestWindow", () => {
  it("composes the date and times into a local-time window", () => {
    const window = composeRequestWindow({ date: "2026-08-17", start: "09:30", end: "11:00" });

    expect(window).not.toBeNull();
    expect(window!.start).toEqual(new Date("2026-08-17T09:30"));
    expect(window!.end).toEqual(new Date("2026-08-17T11:00"));
  });

  it.each([
    ["a blank date", { date: "", start: "09:30", end: "11:00" }],
    ["a blank start", { date: "2026-08-17", start: "", end: "11:00" }],
    ["a blank end", { date: "2026-08-17", start: "09:30", end: "" }],
    ["null fields", { date: null, start: null, end: null }],
    ["absent fields", {}],
  ])("returns null for %s", (_label, value) => {
    expect(composeRequestWindow(value)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(composeRequestWindow({ date: "not-a-date", start: "09:30", end: "11:00" })).toBeNull();
  });
});

describe("requestWindowProblem", () => {
  it("accepts a window whose end is after its start", () => {
    expect(requestWindowProblem({ date: "2026-08-17", start: "09:00", end: "10:00" })).toBeNull();
  });

  it("stays quiet while the window is incomplete", () => {
    expect(requestWindowProblem({ date: "2026-08-17", start: "09:00", end: "" })).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(requestWindowProblem({ date: "2026-08-17", start: "10:00", end: "09:00" })).toBe(
      "endBeforeStart",
    );
  });

  it("rejects an end equal to the start — a zero-length window grants nothing", () => {
    expect(requestWindowProblem({ date: "2026-08-17", start: "10:00", end: "10:00" })).toBe(
      "endBeforeStart",
    );
  });

  it("accepts a window exactly at the maximum", () => {
    // The form carries a single date, so the 24h boundary is expressed as 00:00 to 24:00.
    const start = new Date("2026-08-17T00:00");
    const end = new Date(start.getTime() + MAX_REQUEST_ACCESS_WINDOW_SECONDS * 1000);

    expect(
      requestWindowProblem({
        date: toDateInputValue(start),
        start: toTimeInputValue(start),
        end: "24:00",
      }),
    ).toBeNull();
    expect(end.getTime() - start.getTime()).toBe(MAX_REQUEST_ACCESS_WINDOW_SECONDS * 1000);
  });
});

describe("defaultRequestWindow", () => {
  it("seeds a window starting now and running the requested duration", () => {
    const now = new Date(2026, 7, 17, 9, 15, 0);

    expect(defaultRequestWindow(now, 3600)).toEqual({
      date: "2026-08-17",
      start: "09:15",
      end: "10:15",
    });
  });

  it("clamps to 23:59 rather than rolling past midnight", () => {
    // Rolling over would put the end time BEFORE the start on the single date the form carries,
    // which would trip requestWindowProblem on first paint.
    const now = new Date(2026, 7, 17, 23, 30, 0);

    expect(defaultRequestWindow(now, 3600)).toEqual({
      date: "2026-08-17",
      start: "23:30",
      end: "23:59",
    });
  });

  it("seeds a window the validator accepts", () => {
    const now = new Date(2026, 7, 17, 9, 15, 0);

    expect(requestWindowProblem(defaultRequestWindow(now, 3600))).toBeNull();
  });
});

describe("toDateInputValue / toTimeInputValue", () => {
  it("zero-pads month, day, hour and minute", () => {
    const date = new Date(2026, 0, 5, 7, 8, 0);

    expect(toDateInputValue(date)).toBe("2026-01-05");
    expect(toTimeInputValue(date)).toBe("07:08");
  });
});
