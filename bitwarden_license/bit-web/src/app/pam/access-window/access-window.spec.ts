import {
  accessWindowProblem,
  composeAccessWindow,
  composeInstant,
  defaultAccessWindow,
  toDateValue,
  toTimeValue,
} from "./access-window";

const DAY = 24 * 60 * 60;

describe("composeInstant", () => {
  it("reads the pair as local time", () => {
    const at = composeInstant("2027-03-04", "09:30")!;
    expect(at.getFullYear()).toBe(2027);
    expect(at.getMonth()).toBe(2);
    expect(at.getDate()).toBe(4);
    expect(at.getHours()).toBe(9);
    expect(at.getMinutes()).toBe(30);
  });

  it.each([
    ["", "09:30"],
    ["2027-03-04", ""],
    [null, null],
  ])("is null while either half is blank (%s, %s)", (date, time) => {
    expect(composeInstant(date, time)).toBeNull();
  });

  it("is null for an unparseable pair", () => {
    expect(composeInstant("2027-13-45", "99:99")).toBeNull();
  });
});

describe("composeAccessWindow", () => {
  it("composes both ends", () => {
    const window = composeAccessWindow({
      startDate: "2027-03-04",
      startTime: "22:00",
      endDate: "2027-03-05",
      endTime: "02:00",
    })!;
    expect((window.end.getTime() - window.start.getTime()) / 3_600_000).toBe(4);
  });

  /**
   * The behaviour the four-field shape exists for: under the single-date model an end time
   * earlier than the start was rolled to the next day, so an end EARLIER on a LATER day could
   * not be expressed at all — and an end earlier the same day was silently moved.
   */
  it("keeps an end that is before the start rather than rolling it forward", () => {
    const window = composeAccessWindow({
      startDate: "2027-03-04",
      startTime: "09:00",
      endDate: "2027-03-04",
      endTime: "08:00",
    })!;
    expect(toDateValue(window.end)).toBe("2027-03-04");
    expect(window.end.getTime()).toBeLessThan(window.start.getTime());
  });

  it("is null while any of the four is blank", () => {
    expect(
      composeAccessWindow({
        startDate: "2027-03-04",
        startTime: "09:00",
        endDate: "",
        endTime: "",
      }),
    ).toBeNull();
  });
});

describe("accessWindowProblem", () => {
  const CAP_SECONDS = 4 * 3600;

  // A future start, so only the end under test decides the verdict.
  const start = { startDate: "2099-03-04", startTime: "09:00" };

  it.each([
    ["passes a window inside the cap", "2099-03-04", "12:00", null],
    ["is null while the window is incomplete, rather than guessing", "", "", null],
    ["refuses an end equal to the start", "2099-03-04", "09:00", "zeroLengthWindow"],
    // An end before the start is an ordering mistake now that the end names its own day, not the
    // midnight crossing the single-date model read it as.
    ["refuses an end before the start", "2099-03-04", "08:00", "zeroLengthWindow"],
    ["refuses a window past the cap", "2099-03-04", "14:00", "exceedsMaxWindow"],
    ["accepts a window exactly at the cap", "2099-03-04", "13:00", null],
  ])("%s", (_name, endDate, endTime, expected) => {
    expect(accessWindowProblem({ ...start, endDate, endTime }, CAP_SECONDS)).toBe(expected);
  });

  // Separate, because these need a start in the PAST rather than the shared future one.
  it.each([
    ["refuses a window that has already ended", "2020-03-04", "10:00"],
    // The elapsed check comes first, so an over-long window in the past is reported for the
    // reason the requester has to fix first.
    ["reports an elapsed window ahead of its length", "2020-03-06", "10:00"],
  ])("%s", (_name, endDate, endTime) => {
    expect(
      accessWindowProblem(
        { startDate: "2020-03-04", startTime: "09:00", endDate, endTime },
        CAP_SECONDS,
      ),
    ).toBe("endInPast");
  });
});

describe("defaultAccessWindow", () => {
  const openedAt = new Date(2099, 2, 4, 9, 17, 42, 500);

  it("starts at the opening minute, with the seconds dropped", () => {
    const seeded = defaultAccessWindow(openedAt, 3600, DAY);
    expect(seeded.startDate).toBe("2099-03-04");
    expect(seeded.startTime).toBe("09:17");
  });

  it("runs the rule's default duration", () => {
    const window = composeAccessWindow(defaultAccessWindow(openedAt, 2 * 3600, DAY))!;
    expect((window.end.getTime() - window.start.getTime()) / 3_600_000).toBe(2);
  });

  it("clamps a default past the rule's own cap", () => {
    const window = composeAccessWindow(defaultAccessWindow(openedAt, 8 * 3600, 30 * 60))!;
    expect((window.end.getTime() - window.start.getTime()) / 60_000).toBe(30);
  });

  /**
   * The single-date model had to hold a 24h default back by a minute, because an end landing on
   * the start's own wall-clock time read as ambiguous. An explicit end date has no such problem.
   */
  it("seeds a full-day default as a full day", () => {
    const seeded = defaultAccessWindow(openedAt, DAY, DAY);
    const window = composeAccessWindow(seeded)!;
    expect((window.end.getTime() - window.start.getTime()) / 3_600_000).toBe(24);
    expect(seeded.endDate).toBe("2099-03-05");
    expect(seeded.endTime).toBe("09:17");
  });
});

describe("toDateValue / toTimeValue", () => {
  it("zero-pads both", () => {
    const at = new Date(2099, 0, 5, 7, 3);
    expect(toDateValue(at)).toBe("2099-01-05");
    expect(toTimeValue(at)).toBe("07:03");
  });
});
