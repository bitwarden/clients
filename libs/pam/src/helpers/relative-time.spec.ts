import { elapsedKey, formatRelativeTime } from "./relative-time";

describe("elapsedKey", () => {
  const now = new Date("2026-05-15T12:00:00Z");

  it("returns 'just now' for very recent timestamps", () => {
    expect(elapsedKey("2026-05-15T11:59:50Z", now)).toEqual({
      key: "pamInboxElapsedJustNow",
      value: 0,
    });
  });

  it("returns minutes for sub-hour gaps", () => {
    expect(elapsedKey("2026-05-15T11:45:00Z", now)).toEqual({
      key: "pamInboxElapsedMinutes",
      value: 15,
    });
  });

  it("returns hours for sub-day gaps", () => {
    expect(elapsedKey("2026-05-15T08:00:00Z", now)).toEqual({
      key: "pamInboxElapsedHours",
      value: 4,
    });
  });

  it("returns days for multi-day gaps", () => {
    expect(elapsedKey("2026-05-12T12:00:00Z", now)).toEqual({
      key: "pamInboxElapsedDays",
      value: 3,
    });
  });

  it("falls back to 'just now' for unparseable timestamps", () => {
    expect(elapsedKey("not-a-date", now)).toEqual({
      key: "pamInboxElapsedJustNow",
      value: 0,
    });
  });

  it("clamps negative deltas to 'just now'", () => {
    expect(elapsedKey("2026-05-15T13:00:00Z", now)).toEqual({
      key: "pamInboxElapsedJustNow",
      value: 0,
    });
  });
});

describe("formatRelativeTime", () => {
  // Fixed "en" formatter so assertions don't depend on the host locale. We assert
  // against the formatter's own output to validate which unit/value our code
  // selects, without hardcoding ICU's exact narrow-style wording.
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always", style: "narrow" });
  const now = Date.parse("2026-05-15T12:00:00Z");

  it("selects seconds for sub-minute deltas", () => {
    expect(formatRelativeTime(now - 30 * 1000, now, formatter)).toBe(
      formatter.format(-30, "second"),
    );
  });

  it("selects minutes for sub-hour deltas", () => {
    expect(formatRelativeTime(now - 5 * 60 * 1000, now, formatter)).toBe(
      formatter.format(-5, "minute"),
    );
  });

  it("selects hours and keeps the future sign", () => {
    expect(formatRelativeTime(now + 2 * 60 * 60 * 1000, now, formatter)).toBe(
      formatter.format(2, "hour"),
    );
  });

  it("rolls up to days for multi-day deltas", () => {
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000, now, formatter)).toBe(
      formatter.format(-3, "day"),
    );
  });
});
