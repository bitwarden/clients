import {
  PRESET_CRONS,
  QuartzSchedulePreset,
  isLikelyQuartzCron,
  presetForCron,
} from "./quartz-cron";

describe("presetForCron", () => {
  it("returns None for null (no scheduled rotation)", () => {
    expect(presetForCron(null)).toBe(QuartzSchedulePreset.None);
  });

  it.each(Object.entries(PRESET_CRONS) as [keyof typeof PRESET_CRONS, string][])(
    "round-trips: preset '%s' → cron → preset",
    (preset, cron) => {
      expect(presetForCron(cron)).toBe(preset);
    },
  );

  it("returns Custom for a valid but unrecognised cron expression", () => {
    expect(presetForCron("0 15 10 ? * MON-FRI")).toBe(QuartzSchedulePreset.Custom);
  });

  it("returns Custom for a cron that is close but not an exact match", () => {
    // Daily with a different seconds field
    expect(presetForCron("1 0 0 * * ?")).toBe(QuartzSchedulePreset.Custom);
  });

  it("trims leading/trailing whitespace before comparing", () => {
    expect(presetForCron("  0 0 0 * * ?  ")).toBe(QuartzSchedulePreset.Daily);
  });
});

describe("isLikelyQuartzCron", () => {
  it("accepts all PRESET_CRONS values", () => {
    for (const expr of Object.values(PRESET_CRONS)) {
      expect(isLikelyQuartzCron(expr)).toBe(true);
    }
  });

  it("accepts a valid 6-field weekday-range expression", () => {
    expect(isLikelyQuartzCron("0 15 10 ? * MON-FRI")).toBe(true);
  });

  it("accepts a valid 7-field expression with a year", () => {
    expect(isLikelyQuartzCron("0 0 12 1 1 ? 2030")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isLikelyQuartzCron("")).toBe(false);
  });

  it("rejects a plain non-cron string", () => {
    expect(isLikelyQuartzCron("not a cron")).toBe(false);
  });

  it("rejects a 5-field UNIX cron (not a Quartz cron)", () => {
    expect(isLikelyQuartzCron("*/5 * * * *")).toBe(false);
  });

  it("rejects an 8-field expression (too many fields)", () => {
    expect(isLikelyQuartzCron("0 0 0 * * ? 2030 extra")).toBe(false);
  });

  it("rejects a 6-field expression containing an illegal character ($)", () => {
    expect(isLikelyQuartzCron("0 0 * * * $")).toBe(false);
  });

  it("rejects a 6-field expression containing an illegal character (!)", () => {
    expect(isLikelyQuartzCron("0 0 0 ! * ?")).toBe(false);
  });
});
