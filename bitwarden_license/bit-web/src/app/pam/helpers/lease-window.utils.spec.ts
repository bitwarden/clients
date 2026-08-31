import {
  ACCESS_RULE_DURATION_PRESETS,
  DEFAULT_ACCESS_RULE_DURATION_SECONDS,
  REQUEST_ACCESS_DURATION_PRESETS,
  pickDurationUnit,
  requestDurationOptions,
  snapToNearestAccessRuleDuration,
  snapToNearestDuration,
} from "./lease-window.utils";

describe("ACCESS_RULE_DURATION_PRESETS", () => {
  it("labels the 24-hour preset to match what the list renders for the same value", () => {
    // pickDurationUnit promotes 86400s to "1 day" in the list's Maximum duration cell
    // (see pickDurationUnit below); the editor's own label must read the same way.
    const preset = ACCESS_RULE_DURATION_PRESETS.find((p) => p.seconds === 24 * 60 * 60);

    expect(preset?.labelKey).toBe("pamAccessRuleDuration1d");
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

describe("requestDurationOptions", () => {
  const seconds = (options: { seconds: number }[]) => options.map((o) => o.seconds);

  it("drops presets above the rule's cap", () => {
    // PM-39858: a rule capped at 30m must not offer the 1h preset.
    expect(seconds(requestDurationOptions(30 * 60, 15 * 60))).toEqual([15 * 60, 30 * 60]);
  });

  it("offers every preset when the cap is the global ceiling", () => {
    expect(seconds(requestDurationOptions(24 * 60 * 60, 60 * 60))).toEqual(
      REQUEST_ACCESS_DURATION_PRESETS.map((p) => p.seconds),
    );
  });

  it("keeps the i18n label of a preset-backed option", () => {
    const [first] = requestDurationOptions(30 * 60, 15 * 60);

    expect(first.labelKey).toBe("requestAccessModalDuration15m");
  });

  it("offers the cap itself when no preset matches it, unlabelled for value formatting", () => {
    const options = requestDurationOptions(45 * 60, 15 * 60);

    expect(seconds(options)).toEqual([15 * 60, 30 * 60, 45 * 60]);
    expect(options[2].labelKey).toBeUndefined();
  });

  it("stays non-empty for a cap below the smallest preset", () => {
    // Filtering alone would leave nothing to pick, making the form unsubmittable.
    expect(seconds(requestDurationOptions(5 * 60, 5 * 60))).toEqual([5 * 60]);
  });

  it("offers the default so the pre-selected value is always a real option", () => {
    const options = requestDurationOptions(60 * 60, 20 * 60);

    expect(seconds(options)).toContain(20 * 60);
    expect(seconds(options)).toEqual([15 * 60, 20 * 60, 30 * 60, 60 * 60]);
  });

  it("does not duplicate a default that already matches a preset", () => {
    expect(seconds(requestDurationOptions(30 * 60, 30 * 60))).toEqual([15 * 60, 30 * 60]);
  });

  it("ignores a default above the cap rather than offering an over-cap option", () => {
    // The server clamps the default, so this only guards a malformed pair.
    expect(seconds(requestDurationOptions(30 * 60, 4 * 60 * 60))).toEqual([15 * 60, 30 * 60]);
  });
});
