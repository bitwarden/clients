import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  lastRotatedText,
  lastSeenText,
  nextRotationText,
  relativeTimeLabel,
} from "./rotation-relative-time";

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

describe("lastSeenText", () => {
  it.each([
    [HOUR, { key: "pamRotationRelativeHoursAgo", count: 1 }],
    [3 * HOUR + 20 * MINUTE, { key: "pamRotationRelativeHoursAgo", count: 3 }],
    [23 * HOUR + 59 * MINUTE, { key: "pamRotationRelativeHoursAgo", count: 23 }],
    [5 * MINUTE, { key: "pamRotationRelativeMinutesAgo", count: 5 }],
    [DAY, { key: "pamRotationRelativeYesterday" }],
    [0, { key: "justNow" }],
    [MINUTE - 1, { key: "justNow" }],
    [-5_000, { key: "justNow" }],
    [MINUTE, { key: "pamRotationRelativeMinutesAgo", count: 1 }],
    [HOUR - 1, { key: "pamRotationRelativeMinutesAgo", count: 59 }],
    [DAY - 1, { key: "pamRotationRelativeHoursAgo", count: 23 }],
    [2 * DAY - 1, { key: "pamRotationRelativeYesterday" }],
    [2 * DAY, { key: "pamRotationRelativeDaysAgo", count: 2 }],
    [7 * DAY, { key: "pamRotationRelativeWeeksAgo", count: 1 }],
    [30 * DAY, { key: "pamRotationRelativeMonthsAgo", count: 1 }],
    [364 * DAY, { key: "pamRotationRelativeMonthsAgo", count: 12 }],
  ])("formats %d ms ago", (elapsed, expected) => {
    expect(lastSeenText(NOW - elapsed, NOW)).toEqual(expected);
  });

  it("reads never when the connector has not checked in", () => {
    expect(lastSeenText(null, NOW)).toEqual({ key: "never" });
  });

  it("still has no wording for years", () => {
    expect(lastSeenText(NOW - 365 * DAY, NOW)).toBeNull();
    expect(lastSeenText(NOW - 400 * DAY, NOW)).toBeNull();
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

describe("relativeTimeLabel", () => {
  const i18n = {
    t: (key: string, count?: string | number) => `${key}:${count ?? ""}`,
  } as unknown as Pick<I18nService, "t">;

  it("is null when there is no wording", () => {
    expect(relativeTimeLabel(i18n, null)).toBeNull();
  });

  it("translates a key without a count", () => {
    expect(relativeTimeLabel(i18n, { key: "never" })).toBe("never:");
  });

  it("passes the count to the translator", () => {
    expect(relativeTimeLabel(i18n, { key: "pamRotationRelativeMinutesAgo", count: 5 })).toBe(
      "pamRotationRelativeMinutesAgo:5",
    );
  });
});
