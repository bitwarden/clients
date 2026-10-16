import { formatClockTime, formatWindowDay, windowParts } from "./format-window";

function at(year: number, month: number, day: number, hour: number, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

const NOW = at(2026, 8, 20, 9, 0);

describe("formatClockTime", () => {
  it("drops the minutes on the hour", () => {
    expect(formatClockTime("en-US", at(2026, 8, 20, 9, 0))).toBe("9 AM");
    expect(formatClockTime("en-US", at(2026, 8, 20, 13, 0))).toBe("1 PM");
  });

  it("keeps the minutes off the hour", () => {
    expect(formatClockTime("en-US", at(2026, 8, 20, 17, 11))).toBe("5:11 PM");
  });

  it("keeps the meridiem under a locale that would otherwise use the 24-hour clock", () => {
    const afternoon = formatClockTime("en-GB", at(2026, 8, 20, 17, 11));

    expect(afternoon.toLowerCase()).toContain("pm");
    expect(afternoon).toContain("5:11");
  });
});

describe("formatWindowDay", () => {
  it("says nothing for today, which the row is already read on", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 20, 17, 0), NOW)).toBe("");
  });

  it("words the days either side of today", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 21, 9, 0), NOW)).toBe("Tomorrow");
    expect(formatWindowDay("en-US", at(2026, 8, 19, 9, 0), NOW)).toBe("Yesterday");
  });

  it("dates anything further out", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 25, 9, 0), NOW)).toBe("Aug 25");
  });

  it("counts calendar days rather than elapsed hours", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 20, 23, 59), NOW)).toBe("");
    expect(formatWindowDay("en-US", at(2026, 8, 21, 0, 1), NOW)).toBe("Tomorrow");
  });
});

describe("windowParts", () => {
  it("leaves a window inside today with bare times", () => {
    const parts = windowParts("en-US", at(2026, 8, 20, 17, 11), at(2026, 8, 20, 19, 11), NOW);

    expect(parts).toEqual({
      sharedDay: "",
      start: { day: "", time: "5:11 PM" },
      end: { day: "", time: "7:11 PM" },
    });
  });

  it("states a shared day once, in front of the range", () => {
    const parts = windowParts("en-US", at(2026, 8, 21, 9, 0), at(2026, 8, 21, 13, 0), NOW);

    expect(parts).toEqual({
      sharedDay: "Tomorrow",
      start: { day: "", time: "9 AM" },
      end: { day: "", time: "1 PM" },
    });
  });

  it("dates a shared day that is neither today nor tomorrow", () => {
    const parts = windowParts("en-US", at(2026, 8, 25, 9, 0), at(2026, 8, 25, 13, 0), NOW);

    expect(parts.sharedDay).toBe("Aug 25");
  });

  it("gives each end its own day when the window spans days", () => {
    const parts = windowParts("en-US", at(2026, 8, 25, 9, 0), at(2026, 8, 26, 13, 0), NOW);

    expect(parts).toEqual({
      sharedDay: "",
      start: { day: "Aug 25", time: "9 AM" },
      end: { day: "Aug 26", time: "1 PM" },
    });
  });

  it("day-qualifies a window that runs from today into tomorrow", () => {
    const parts = windowParts("en-US", at(2026, 8, 20, 22, 0), at(2026, 8, 21, 2, 0), NOW);

    expect(parts.sharedDay).toBe("");
    expect(parts.start).toEqual({ day: "", time: "10 PM" });
    expect(parts.end).toEqual({ day: "Tomorrow", time: "2 AM" });
  });
});
