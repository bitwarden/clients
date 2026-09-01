import {
  MAX_REQUEST_ACCESS_WINDOW_SECONDS,
  type RequestWindowFormValue,
  composeRequestWindow,
  defaultRequestWindow,
  midnightCrossingEnd,
  requestWindowProblem,
  toDateInputValue,
  toTimeInputValue,
} from "./request-access-window";

/**
 * The instant the fixed windows below are judged against. Pinned rather than left to the real
 * clock: `requestWindowProblem` rejects a window that has already ended, so literal dates close to
 * the day a test was written would pass then and fail later.
 */
const NOW = new Date("2026-08-17T08:00");

/** {@link requestWindowProblem} against {@link NOW}, so every case reads as one line. */
const problemAt = (
  value: RequestWindowFormValue,
  maxWindowSeconds: number = MAX_REQUEST_ACCESS_WINDOW_SECONDS,
) => requestWindowProblem(value, maxWindowSeconds, NOW);

describe("composeRequestWindow", () => {
  it("composes the date and times into a local-time window", () => {
    const window = composeRequestWindow({ date: "2026-08-17", start: "09:30", end: "11:00" });

    expect(window).not.toBeNull();
    expect(window!.start).toEqual(new Date("2026-08-17T09:30"));
    expect(window!.end).toEqual(new Date("2026-08-17T11:00"));
  });

  // PM-42593: the form carries one date, so an end earlier than the start is the only way to
  // spell a window that crosses midnight — it used to be refused as inverted instead.
  it("resolves an end earlier than the start onto the following day", () => {
    const window = composeRequestWindow({ date: "2026-08-17", start: "23:00", end: "01:00" });

    expect(window!.start).toEqual(new Date("2026-08-17T23:00"));
    expect(window!.end).toEqual(new Date("2026-08-18T01:00"));
  });

  it("leaves an end equal to the start alone, for the validator to refuse", () => {
    // The one shape a single date cannot disambiguate: a zero-length window or a full 24h one.
    const window = composeRequestWindow({ date: "2026-08-17", start: "09:30", end: "09:30" });

    expect(window!.end).toEqual(window!.start);
  });

  it("rolls the end onto the next calendar day across a month boundary", () => {
    const window = composeRequestWindow({ date: "2026-08-31", start: "22:00", end: "02:00" });

    expect(window!.end).toEqual(new Date("2026-09-01T02:00"));
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

describe("midnightCrossingEnd", () => {
  it("reports the resolved end of a window that crosses midnight", () => {
    expect(midnightCrossingEnd({ date: "2026-08-17", start: "23:00", end: "01:00" })).toEqual(
      new Date("2026-08-18T01:00"),
    );
  });

  it("reports nothing for a window that stays on its own date", () => {
    expect(midnightCrossingEnd({ date: "2026-08-17", start: "09:00", end: "10:00" })).toBeNull();
  });

  it("reports nothing while the window is incomplete", () => {
    expect(midnightCrossingEnd({ date: "2026-08-17", start: "23:00", end: "" })).toBeNull();
  });
});

describe("requestWindowProblem", () => {
  it("accepts a window whose end is after its start", () => {
    expect(problemAt({ date: "2026-08-17", start: "09:00", end: "10:00" })).toBeNull();
  });

  it("stays quiet while the window is incomplete", () => {
    expect(problemAt({ date: "2026-08-17", start: "09:00", end: "" })).toBeNull();
  });

  // PM-42593: an end before the start is a window crossing midnight, not an inverted one.
  it("accepts an end before the start — it runs to the following day", () => {
    expect(problemAt({ date: "2026-08-17", start: "23:00", end: "01:00" })).toBeNull();
  });

  it("rejects an end equal to the start — a zero-length window grants nothing", () => {
    expect(problemAt({ date: "2026-08-17", start: "10:00", end: "10:00" })).toBe(
      "zeroLengthWindow",
    );
  });

  it("accepts a window exactly at the maximum", () => {
    // The form carries a single date, so the 24h boundary is expressed as 00:00 to 24:00.
    const start = new Date("2026-08-17T00:00");
    const end = new Date(start.getTime() + MAX_REQUEST_ACCESS_WINDOW_SECONDS * 1000);

    expect(
      problemAt({
        date: toDateInputValue(start),
        start: toTimeInputValue(start),
        end: "24:00",
      }),
    ).toBeNull();
    expect(end.getTime() - start.getTime()).toBe(MAX_REQUEST_ACCESS_WINDOW_SECONDS * 1000);
  });

  // PM-39858: checking only the global ceiling let a window past the governing rule's own maximum
  // look valid in the form, right up until submit rejected it.
  it("rejects a window past an explicit per-rule maximum", () => {
    const window = { date: "2026-08-17", start: "09:00", end: "11:00" };

    // Two hours: inside the global ceiling, outside a 30-minute rule cap.
    expect(problemAt(window)).toBeNull();
    expect(problemAt(window, 30 * 60)).toBe("exceedsMaxWindow");
  });

  it("accepts a window exactly at an explicit per-rule maximum", () => {
    expect(problemAt({ date: "2026-08-17", start: "09:00", end: "09:30" }, 30 * 60)).toBeNull();
  });

  it("measures a midnight-crossing window against the per-rule maximum", () => {
    // 23:00-01:00 is two hours once resolved onto the next day, so a 30-minute cap refuses it and
    // a four-hour one does not. Neither reads it as inverted.
    expect(problemAt({ date: "2026-08-17", start: "23:00", end: "01:00" }, 30 * 60)).toBe(
      "exceedsMaxWindow",
    );
    expect(problemAt({ date: "2026-08-17", start: "23:00", end: "01:00" }, 4 * 3600)).toBeNull();
  });

  it("reports a zero-length window before checking the per-rule maximum", () => {
    // The zero-length message is the more useful one, so it wins even when both are wrong.
    expect(problemAt({ date: "2026-08-17", start: "11:00", end: "11:00" }, 30 * 60)).toBe(
      "zeroLengthWindow",
    );
  });

  // PM-42592: a window dated before the request was submitted sailed through the form, and the
  // server persisted it as a pending request that activation could then never start.
  it("rejects a window that has already ended", () => {
    expect(problemAt({ date: "2026-08-09", start: "07:00", end: "08:00" })).toBe("endInPast");
  });

  it("rejects a past window on today's date too — the date alone is not the test", () => {
    // NOW is 08:00, so a 06:00–07:00 window is over even though its date is today. The `min` on
    // the date input cannot catch this one; only the composed window can.
    expect(problemAt({ date: "2026-08-17", start: "06:00", end: "07:00" })).toBe("endInPast");
  });

  it("rejects a window ending exactly now", () => {
    // Matches activation's own `NotAfter <= now` refusal: a window with no time left is not a
    // window.
    expect(problemAt({ date: "2026-08-17", start: "07:00", end: "08:00" })).toBe("endInPast");
  });

  it("accepts a window already under way", () => {
    // Only the END is checked. The form seeds `start` at "now", so every submit lands fractionally
    // after its own start — a start-based rule would reject the ordinary case.
    expect(problemAt({ date: "2026-08-17", start: "07:00", end: "09:00" })).toBeNull();
  });

  it("reports a zero-length window before a past one", () => {
    // Both rules fire on a zero-length window sitting in the past. The length is the edit the
    // requester has to make before the window's position is even meaningful.
    expect(problemAt({ date: "2026-08-09", start: "08:00", end: "08:00" })).toBe(
      "zeroLengthWindow",
    );
  });

  it("judges a midnight-crossing window on the day its end lands", () => {
    // NOW is 08:00 on the 17th, so the 16th's 23:00-01:00 window ended seven hours ago — but a
    // window from 23:00 tonight is still to come.
    expect(problemAt({ date: "2026-08-16", start: "23:00", end: "01:00" })).toBe("endInPast");
    expect(problemAt({ date: "2026-08-17", start: "23:00", end: "01:00" })).toBeNull();
  });

  it("reports a past window before an over-long one", () => {
    // "Move it into the future" comes first; length only matters once the window could run.
    expect(problemAt({ date: "2026-08-09", start: "06:00", end: "08:00" }, 30 * 60)).toBe(
      "endInPast",
    );
  });

  it("measures against the real clock when no instant is given", () => {
    // The validator calls through without an explicit `now`, so the default has to be live.
    expect(requestWindowProblem({ date: "2020-01-01", start: "09:00", end: "10:00" })).toBe(
      "endInPast",
    );
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

  // PM-42593: this used to clamp to 23:59, so a fold-out opened at 23:30 offered 29 minutes of an
  // hour-long default.
  it("seeds the whole duration past midnight rather than clamping to 23:59", () => {
    const now = new Date(2026, 7, 17, 23, 30, 0);

    expect(defaultRequestWindow(now, 3600)).toEqual({
      date: "2026-08-17",
      start: "23:30",
      end: "00:30",
    });
    expect(composeRequestWindow(defaultRequestWindow(now, 3600))).toEqual({
      start: now,
      end: new Date(2026, 7, 18, 0, 30, 0),
    });
  });

  it("stops a minute short of a full 24h duration", () => {
    // The seed is the one place the ambiguity has to be resolved: 24h would put the same
    // wall-clock time in both fields, which composeRequestWindow reads as zero-length.
    const now = new Date(2026, 7, 17, 9, 15, 0);

    expect(defaultRequestWindow(now, MAX_REQUEST_ACCESS_WINDOW_SECONDS)).toEqual({
      date: "2026-08-17",
      start: "09:15",
      end: "09:14",
    });
  });

  it("seeds at least a minute for a sub-minute duration", () => {
    // Below the time inputs' own step the two fields would land on the same minute, which reads
    // back as a zero-length window rather than as the seconds asked for.
    const now = new Date(2026, 7, 17, 9, 15, 0);

    expect(defaultRequestWindow(now, 10)).toEqual({
      date: "2026-08-17",
      start: "09:15",
      end: "09:16",
    });
  });

  it.each([
    ["a mid-morning open", new Date(2026, 7, 17, 9, 15, 0), 3600],
    ["an open close to midnight", new Date(2026, 7, 17, 23, 30, 0), 3600],
    ["a rule defaulting to a full day", new Date(2026, 7, 17, 9, 15, 0), 86400],
    ["a rule defaulting to seconds", new Date(2026, 7, 17, 9, 15, 0), 10],
  ])("seeds a window the validator accepts on %s", (_label, now, duration) => {
    // Including the past-window rule: the seeded end is always after the instant it was seeded
    // from, so opening the fold-out can never paint an error.
    expect(requestWindowProblem(defaultRequestWindow(now, duration), undefined, now)).toBeNull();
  });
});

describe("toDateInputValue / toTimeInputValue", () => {
  it("zero-pads month, day, hour and minute", () => {
    const date = new Date(2026, 0, 5, 7, 8, 0);

    expect(toDateInputValue(date)).toBe("2026-01-05");
    expect(toTimeInputValue(date)).toBe("07:08");
  });
});
