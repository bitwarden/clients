import {
  ACCESS_RULE_DURATION_PRESETS,
  DEFAULT_ACCESS_RULE_DURATION_SECONDS,
  pickDurationUnit,
  snapToNearestAccessRuleDuration,
  snapToNearestDuration,
} from "./lease-window.utils";

describe("ACCESS_RULE_DURATION_PRESETS", () => {
  it("labels the 24-hour preset to match what the list renders for the same value", () => {
    // `pickDurationUnit` promotes 86400s to "1 day" in the list; the editor's label must match.
    const preset = ACCESS_RULE_DURATION_PRESETS.find((p) => p.seconds === 24 * 60 * 60);

    expect(preset?.labelKey).toBe("pamAccessRuleDuration1d");
  });

  it("labels every multi-day preset in the unit the list promotes it to", () => {
    const dayPresets = ACCESS_RULE_DURATION_PRESETS.filter(
      (p) => pickDurationUnit(p.seconds).unit === "day",
    );

    expect(dayPresets.map((p) => [p.seconds, p.labelKey])).toEqual([
      [24 * 60 * 60, "pamAccessRuleDuration1d"],
      [2 * 24 * 60 * 60, "pamAccessRuleDuration2d"],
      [7 * 24 * 60 * 60, "pamAccessRuleDuration7d"],
      [30 * 24 * 60 * 60, "pamAccessRuleDuration30d"],
    ]);
  });

  it("offers the presets in ascending order, so the pickers read low to high", () => {
    const seconds = ACCESS_RULE_DURATION_PRESETS.map((p) => p.seconds);

    expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
  });
});

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
    expect(snapToNearestDuration(50 * 60, options)).toBe(60 * 60);
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
    expect(snapToNearestAccessRuleDuration(50 * 60)).toBe(60 * 60);
    expect(snapToNearestAccessRuleDuration(20 * 60)).toBe(15 * 60);
  });
});
