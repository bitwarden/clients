import {
  DEFAULT_ACCESS_RULE_DURATION_SECONDS,
  pickDurationUnit,
  snapToNearestAccessRuleDuration,
  snapToNearestDuration,
} from "./lease-window.utils";

describe("pickDurationUnit", () => {
  it("picks whole-day durations as days", () => {
    expect(pickDurationUnit(24 * 60 * 60)).toEqual({ value: 1, unit: "day" });
    expect(pickDurationUnit(7 * 24 * 60 * 60)).toEqual({ value: 7, unit: "day" });
  });

  it("picks whole-hour durations as hours", () => {
    expect(pickDurationUnit(60 * 60)).toEqual({ value: 1, unit: "hour" });
    expect(pickDurationUnit(4 * 60 * 60)).toEqual({ value: 4, unit: "hour" });
  });

  it("picks whole-minute durations as minutes", () => {
    expect(pickDurationUnit(15 * 60)).toEqual({ value: 15, unit: "minute" });
  });

  it("falls back to seconds for sub-minute durations", () => {
    expect(pickDurationUnit(45)).toEqual({ value: 45, unit: "second" });
  });
});

describe("snapToNearestDuration", () => {
  const options = [{ seconds: 30 * 60 }, { seconds: 60 * 60 }, { seconds: 2 * 60 * 60 }];

  it("returns an exact option value unchanged", () => {
    expect(snapToNearestDuration(60 * 60, options)).toBe(60 * 60);
  });

  it("snaps an off-option value to the nearest option", () => {
    // 50m is closer to 1h than to 30m.
    expect(snapToNearestDuration(50 * 60, options)).toBe(60 * 60);
    // 100m is closer to 2h than to 1h.
    expect(snapToNearestDuration(100 * 60, options)).toBe(2 * 60 * 60);
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
