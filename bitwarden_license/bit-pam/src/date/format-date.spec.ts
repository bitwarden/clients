import {
  formatCalendarDate,
  formatClockTime,
  formatTimeOfDay,
  formatTimestamp,
} from "./format-date";

function at(month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(2026, month - 1, day, hour, minute, second).getTime();
}

describe("formatCalendarDate", () => {
  it("abbreviates the month and includes the year", () => {
    expect(formatCalendarDate("en-US", at(11, 4))).toBe("Nov 4, 2026");
    expect(formatCalendarDate("en-US", at(1, 13))).toBe("Jan 13, 2026");
  });

  it("abbreviates September as Sept in English", () => {
    expect(formatCalendarDate("en-US", at(9, 19))).toBe("Sept 19, 2026");
    expect(formatCalendarDate("en-GB", at(9, 19))).toBe("19 Sept 2026");
  });

  it("follows the locale's own order and month names", () => {
    expect(formatCalendarDate("de", at(11, 4))).toBe("4. Nov. 2026");
  });

  it("stays on the Gregorian calendar with Latin digits", () => {
    expect(formatCalendarDate("fa", at(11, 4))).toContain("2026");
    expect(formatCalendarDate("th", at(11, 4))).toContain("2026");
  });
});

describe("formatTimestamp", () => {
  it("adds the time to the date", () => {
    expect(formatTimestamp("en-US", at(11, 4, 15, 45))).toBe("Nov 4, 2026, 3:45 PM");
    expect(formatTimestamp("en-US", at(9, 19, 19, 0))).toBe("Sept 19, 2026, 7:00 PM");
  });

  it("uses the locale's own clock", () => {
    expect(formatTimestamp("en-GB", at(9, 19, 19, 0))).toBe("19 Sept 2026, 19:00");
  });

  it("adds the seconds when asked", () => {
    expect(formatTimestamp("en-US", at(11, 4, 15, 45, 7), "second")).toBe(
      "Nov 4, 2026, 3:45:07 PM",
    );
  });
});

describe("formatTimeOfDay", () => {
  it("gives the time alone", () => {
    expect(formatTimeOfDay("en-US", at(11, 4, 15, 45))).toBe("3:45 PM");
    expect(formatTimeOfDay("en-GB", at(11, 4, 15, 45))).toBe("15:45");
  });
});

describe("formatClockTime", () => {
  it("drops the minutes on the hour", () => {
    expect(formatClockTime("en-US", at(8, 20, 9, 0))).toBe("9 AM");
    expect(formatClockTime("en-US", at(8, 20, 13, 0))).toBe("1 PM");
  });

  it("keeps the minutes off the hour", () => {
    expect(formatClockTime("en-US", at(8, 20, 17, 11))).toBe("5:11 PM");
  });

  it("keeps the meridiem under a locale that would otherwise use the 24-hour clock", () => {
    const afternoon = formatClockTime("en-GB", at(8, 20, 17, 11));

    expect(afternoon.toLowerCase()).toContain("pm");
    expect(afternoon).toContain("5:11");
  });

  it("uses Latin digits, like the date beside it", () => {
    expect(formatClockTime("fa", at(8, 20, 17, 11))).toContain("5:11");
  });
});

describe("an unparseable instant", () => {
  it("formats as empty rather than throwing", () => {
    expect(formatCalendarDate("en-US", Number.NaN)).toBe("");
    expect(formatTimestamp("en-US", Number.NaN)).toBe("");
  });
});
