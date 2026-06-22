import {
  DEFAULT_ACCESS_RULE_DURATION_SECONDS,
  formatDurationShort,
  snapToNearestAccessRuleDuration,
} from "./lease-window.utils";

describe("formatDurationShort", () => {
  it("renders whole-day durations in days", () => {
    expect(formatDurationShort(24 * 60 * 60)).toBe("1d");
    expect(formatDurationShort(7 * 24 * 60 * 60)).toBe("7d");
  });

  it("renders whole-hour durations in hours", () => {
    expect(formatDurationShort(60 * 60)).toBe("1h");
    expect(formatDurationShort(4 * 60 * 60)).toBe("4h");
  });

  it("renders whole-minute durations in minutes", () => {
    expect(formatDurationShort(15 * 60)).toBe("15m");
  });

  it("falls back to seconds for sub-minute durations", () => {
    expect(formatDurationShort(45)).toBe("45s");
  });
});

describe("snapToNearestAccessRuleDuration", () => {
  it("falls back to the default when no value is stored", () => {
    expect(snapToNearestAccessRuleDuration(null)).toBe(DEFAULT_ACCESS_RULE_DURATION_SECONDS);
    expect(snapToNearestAccessRuleDuration(undefined)).toBe(DEFAULT_ACCESS_RULE_DURATION_SECONDS);
  });

  it("returns an exact preset value unchanged", () => {
    expect(snapToNearestAccessRuleDuration(4 * 60 * 60)).toBe(4 * 60 * 60);
  });

  it("snaps an off-preset value to the nearest preset", () => {
    // 50m is closer to 1h (60m) than to 30m.
    expect(snapToNearestAccessRuleDuration(50 * 60)).toBe(60 * 60);
    // 20m is closer to 15m than to 30m.
    expect(snapToNearestAccessRuleDuration(20 * 60)).toBe(15 * 60);
  });
});
