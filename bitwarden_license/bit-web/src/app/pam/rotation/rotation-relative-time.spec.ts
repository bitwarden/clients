import { lastRotatedText, nextRotationText } from "./rotation-relative-time";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("lastRotatedText", () => {
  it("reads never when the credential has not rotated", () => {
    expect(lastRotatedText(null, NOW)).toEqual({ key: "never" });
  });

  it.each([
    [0, { key: "justNow" }],
    [30_000, { key: "justNow" }],
    [-5_000, { key: "justNow" }],
    [MINUTE, { key: "pamRotationRelativeMinutesAgo", count: 1 }],
    [6 * MINUTE, { key: "pamRotationRelativeMinutesAgo", count: 6 }],
    [59 * MINUTE, { key: "pamRotationRelativeMinutesAgo", count: 59 }],
    [DAY, { key: "pamRotationRelativeYesterday" }],
    [5 * DAY, { key: "pamRotationRelativeDaysAgo", count: 5 }],
    [14 * DAY, { key: "pamRotationRelativeWeeksAgo", count: 2 }],
    [21 * DAY, { key: "pamRotationRelativeWeeksAgo", count: 3 }],
    [30 * DAY, { key: "pamRotationRelativeMonthsAgo", count: 1 }],
    [95 * DAY, { key: "pamRotationRelativeMonthsAgo", count: 3 }],
  ])("formats %d ms ago", (elapsed, expected) => {
    expect(lastRotatedText(NOW - elapsed, NOW)).toEqual(expected);
  });

  it("has no wording for hours or years, which the design does not show", () => {
    expect(lastRotatedText(NOW - 3 * HOUR, NOW)).toBeNull();
    expect(lastRotatedText(NOW - 400 * DAY, NOW)).toBeNull();
  });
});

describe("nextRotationText", () => {
  it.each([
    [HOUR, { key: "pamRotationRelativeInHours", count: 1 }],
    [7 * DAY, { key: "pamRotationRelativeInWeeks", count: 1 }],
    [14 * DAY, { key: "pamRotationRelativeInWeeks", count: 2 }],
    [28 * DAY, { key: "pamRotationRelativeInWeeks", count: 4 }],
  ])("formats %d ms ahead", (ahead, expected) => {
    expect(nextRotationText(NOW + ahead, NOW)).toEqual(expected);
  });

  it("formats an overdue time in days", () => {
    expect(nextRotationText(NOW - 3 * DAY, NOW)).toEqual({
      key: "pamRotationRelativeDueDaysAgo",
      count: 3,
    });
  });

  it("has no wording for spans the design does not show", () => {
    expect(nextRotationText(NOW + 10 * MINUTE, NOW)).toBeNull();
    expect(nextRotationText(NOW + 3 * DAY, NOW)).toBeNull();
    expect(nextRotationText(NOW + 90 * DAY, NOW)).toBeNull();
    expect(nextRotationText(NOW - 2 * HOUR, NOW)).toBeNull();
    expect(nextRotationText(NOW - 20 * DAY, NOW)).toBeNull();
  });
});
