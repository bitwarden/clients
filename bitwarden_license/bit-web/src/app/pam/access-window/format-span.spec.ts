import { formatSpan, smoothSpan } from "./format-span";

describe("formatSpan", () => {
  it.each([
    [45 * 60, "45 min"],
    [4 * 3600, "4 hr"],
    // The case `formatDuration` gets wrong: it renders this as "225 minutes", because 3h45m
    // divides evenly into no larger unit.
    [3 * 3600 + 45 * 60, "3 hr 45 min"],
    [24 * 3600, "1 day"],
    // A week-long rule's cap, and a window most of the way across it: days and hours, because
    // "168 hr" and "84 hr 29 min" are both arithmetic dressed as a reading.
    [7 * 24 * 3600, "7 days"],
    [84 * 3600 + 29 * 60, "3 days 12 hr"],
    [0, "0 min"],
  ])("renders %i seconds as %s", (seconds, expected) => {
    expect(formatSpan("en-US", seconds)).toBe(expected);
  });

  it("drops the minutes beside days, as it drops the seconds beside hours", () => {
    expect(formatSpan("en-US", 25 * 3600 + 59 * 60)).toBe("1 day 1 hr");
  });

  it("floors a sub-minute remainder rather than adding a third unit", () => {
    expect(formatSpan("en-US", 3600 + 59)).toBe("1 hr");
  });

  it("is never negative", () => {
    expect(formatSpan("en-US", -600)).toBe("0 min");
  });
});

describe("smoothSpan", () => {
  it.each([
    // The readings the picker was rendering before it smoothed them.
    [87 * 60, "1 hr 30 min", true],
    [57 * 60, "1 hr", true],
    [29 * 60, "30 min", true],
    [(23 * 60 + 59) * 60, "1 day", true],
    // Already on a ten-minute boundary: no rounding, so no hedge.
    [30 * 60, "30 min", false],
    [2 * 3600, "2 hr", false],
    // Under one step it is reported exactly, rather than rounded away to nothing.
    [4 * 60, "4 min", false],
    [0, "0 min", false],
  ])("renders %i seconds as %s (approximate: %s)", (seconds, text, approximate) => {
    expect(smoothSpan("en-US", seconds)).toEqual({ text, approximate });
  });
});
