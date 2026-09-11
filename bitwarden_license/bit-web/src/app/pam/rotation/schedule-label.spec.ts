import { QuartzSchedulePreset } from "./rotation";
import { parseIntervalCron, resolveScheduleLabel, ScheduleIntervalUnit } from "./schedule-label";

/**
 * The Schedule column used to print the raw expression whenever the SDK called a schedule Custom,
 * so `0 0 3 * * ?` — what the interval builder emits for "every 1 day at 03:00" — reached an
 * operator as Quartz. Every expression the builder can compose has a sentence here, and anything
 * left over says "Custom" while keeping the expression for a tooltip.
 */
describe("resolveScheduleLabel", () => {
  describe("named presets", () => {
    it.each([
      [QuartzSchedulePreset.None, "pamRotationScheduleNone"],
      [QuartzSchedulePreset.Hourly, "pamRotationScheduleHourly"],
      [QuartzSchedulePreset.Every6Hours, "pamRotationScheduleEvery6Hours"],
      [QuartzSchedulePreset.Daily, "pamRotationScheduleDaily"],
      [QuartzSchedulePreset.Weekly, "pamRotationScheduleWeekly"],
      [QuartzSchedulePreset.Monthly, "pamRotationScheduleMonthly"],
    ] as const)("labels %s with its short key", (preset, key) => {
      const label = resolveScheduleLabel(preset, "0 0 0 * * ?");
      expect(label.key).toBe(key);
      expect(label.placeholders).toEqual([]);
      expect(label.rawCron).toBeNull();
    });

    /**
     * The preset table is the SDK's, and it names midnight-daily; the same expression also parses
     * as "every 1 day at 00:00". The preset wins, so the column says "Daily" rather than spelling
     * out an interval the operator never chose.
     */
    it("prefers the preset over the interval the same expression parses as", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Daily, "0 0 0 * * ?").key).toBe(
        "pamRotationScheduleDaily",
      );
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 0 0 * * ?").key).toBe(
        "pamRotationScheduleColumnEveryDay",
      );
    });
  });

  /** Each shape `composeIntervalCron` can emit, back through the label. */
  describe("interval expressions", () => {
    it("labels a one-day interval with its time of day", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 0 3 * * ?")).toEqual({
        key: "pamRotationScheduleColumnEveryDay",
        placeholders: ["03:00"],
        rawCron: null,
      });
    });

    it("labels a multi-day interval with its count and time of day", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 0 2 1/7 * ?")).toEqual({
        key: "pamRotationScheduleColumnEveryNDays",
        placeholders: ["7", "02:00"],
        rawCron: null,
      });
    });

    it("labels a one-month interval with its time of day", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 30 6 1 * ?")).toEqual({
        key: "pamRotationScheduleColumnEveryMonth",
        placeholders: ["06:30"],
        rawCron: null,
      });
    });

    it("labels a multi-month interval with its count and time of day", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 15 23 1 1/3 ?")).toEqual({
        key: "pamRotationScheduleColumnEveryNMonths",
        placeholders: ["3", "23:15"],
        rawCron: null,
      });
    });

    it("zero-pads a single-digit clock reading, as the time input spells it", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 5 9 * * ?").placeholders).toEqual(
        ["09:05"],
      );
    });

    it("carries the counts at the top of each unit's range", () => {
      expect(
        resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 0 0 1/31 * ?").placeholders,
      ).toEqual(["31", "00:00"]);
      expect(
        resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 0 0 1 1/12 ?").placeholders,
      ).toEqual(["12", "00:00"]);
    });

    it("reads an expression with surrounding whitespace", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "  0 0 3 * * ?  ").key).toBe(
        "pamRotationScheduleColumnEveryDay",
      );
    });
  });

  describe("hand-written expressions", () => {
    /** Nothing here describes weekdays, so the label says Custom and keeps the expression. */
    it("falls back to Custom and keeps the expression for a tooltip", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 0 9 ? * MON-FRI")).toEqual({
        key: "pamRotationScheduleCustom",
        placeholders: [],
        rawCron: "0 0 9 ? * MON-FRI",
      });
    });

    it("keeps the trimmed expression, not the operator's spacing", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, " 0 0 9 ? * MON-FRI ").rawCron).toBe(
        "0 0 9 ? * MON-FRI",
      );
    });

    it("falls back to Custom for a step beyond what Quartz's field allows", () => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, "0 0 0 1/32 * ?").key).toBe(
        "pamRotationScheduleCustom",
      );
    });
  });

  /**
   * A Custom preset with no expression rendered an empty `<code></code>` in the column, and an
   * `undefined` one — how a config with no schedule arrives from the server — reached
   * `I18nService.t("")`. Nothing runs without an expression, so all three are no schedule.
   */
  describe("a Custom preset with no expression", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["blank", "   "],
    ] as const)("reads as no schedule when the cron is %s", (_case, cron) => {
      expect(resolveScheduleLabel(QuartzSchedulePreset.Custom, cron)).toEqual({
        key: "pamRotationScheduleNone",
        placeholders: [],
        rawCron: null,
      });
    });
  });

  it("always resolves to a non-empty key, so no cell renders blank", () => {
    const crons = [null, undefined, "", "   ", "nonsense", "0 0 3 * * ?", "0 0 9 ? * MON-FRI"];
    const presets = Object.values(QuartzSchedulePreset);

    for (const preset of presets) {
      for (const cron of crons) {
        expect(resolveScheduleLabel(preset, cron).key).not.toBe("");
      }
    }
  });
});

describe("parseIntervalCron", () => {
  it("reads the unit, count and time from an expression the builder could compose", () => {
    expect(parseIntervalCron("0 0 2 1/7 * ?")).toEqual({
      count: 7,
      unit: ScheduleIntervalUnit.Days,
      time: "02:00",
    });
  });

  it.each([
    ["a five-field expression", "0 2 1/7 * ?"],
    ["a seven-field expression", "0 0 2 1/7 * ? 2026"],
    ["a non-zero seconds field", "30 0 2 * * ?"],
    ["a named day of week", "0 0 9 ? * MON-FRI"],
    ["an hour out of range", "0 0 24 * * ?"],
    ["a minute out of range", "0 60 2 * * ?"],
    ["a step the builder cannot reach", "0 0 2 */7 * ?"],
    ["a month step of one, which is a day interval's shape", "0 0 2 1 1/1 ?"],
  ] as const)("returns null for %s", (_case, cron) => {
    expect(parseIntervalCron(cron)).toBeNull();
  });
});
