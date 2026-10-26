import { QuartzSchedulePreset } from "../rotation";

import {
  composeIntervalCron,
  describeSchedule,
  intervalParts,
  parseIntervalCron,
  SCHEDULE_INTERVAL_MODE,
  ScheduleEchoInput,
  ScheduleInterval,
  ScheduleIntervalUnit,
} from "./rotation-schedule";

const { Days, Months } = ScheduleIntervalUnit;

function interval(count: number, unit: ScheduleIntervalUnit, hh: number, mm: number) {
  return { count, unit, hh, mm } satisfies ScheduleInterval;
}

/** Each interval beside the expression the builder spells it as. */
const INTERVAL_CRONS: ReadonlyArray<readonly [ScheduleInterval, string]> = [
  [interval(1, Days, 0, 0), "0 0 0 * * ?"],
  [interval(1, Days, 2, 30), "0 30 2 * * ?"],
  [interval(7, Days, 2, 0), "0 0 2 1/7 * ?"],
  [interval(30, Days, 23, 15), "0 15 23 1/30 * ?"],
  [interval(1, Months, 0, 0), "0 0 0 1 * ?"],
  [interval(3, Months, 2, 0), "0 0 2 1 1/3 ?"],
  [interval(12, Months, 6, 45), "0 45 6 1 1/12 ?"],
];

describe("composeIntervalCron", () => {
  it.each(INTERVAL_CRONS)("spells %o as %s", (parts, cron) => {
    expect(composeIntervalCron(parts)).toBe(cron);
  });
});

describe("parseIntervalCron", () => {
  it.each(INTERVAL_CRONS)("reads %o back from %s", (parts, cron) => {
    expect(parseIntervalCron(cron)).toEqual(parts);
  });

  it("tolerates surrounding and repeated whitespace", () => {
    expect(parseIntervalCron("  0 0 2  1/7 * ? ")).toEqual(interval(7, Days, 2, 0));
  });

  it.each([
    ["a weekday expression", "0 0 2 ? * MON-FRI"],
    ["a seven-field expression", "0 0 2 1/7 * ? 2027"],
    ["a non-zero second", "30 0 2 * * ?"],
    ["an hour past 23", "0 0 24 * * ?"],
    ["a minute past 59", "0 60 2 * * ?"],
    ["a day step past 31", "0 0 2 1/32 * ?"],
    ["a month step past 12", "0 0 2 1 1/13 ?"],
    ["a monthly step of one, spelled as a step", "0 0 2 1 1/1 ?"],
    ["a month step from a day other than the first", "0 0 2 15 1/3 ?"],
    ["a day step not starting on the first", "0 0 2 2/7 * ?"],
  ])("rejects %s", (_, cron) => {
    expect(parseIntervalCron(cron)).toBeNull();
  });
});

describe("intervalParts", () => {
  it("reads a complete builder", () => {
    expect(intervalParts(7, Days, "02:05")).toEqual(interval(7, Days, 2, 5));
  });

  it("drops seconds from the time", () => {
    expect(intervalParts(1, Months, "06:45:30")).toEqual(interval(1, Months, 6, 45));
  });

  it.each([
    ["a cleared count", null, Days, "02:00"],
    ["a zero count", 0, Days, "02:00"],
    ["a fractional count", 1.5, Days, "02:00"],
    ["a day count beyond 31", 32, Days, "02:00"],
    ["a month count beyond 12", 13, Months, "02:00"],
    ["a cleared time", 7, Days, ""],
    ["an hour past 23", 7, Days, "24:00"],
    ["a minute past 59", 7, Days, "12:60"],
  ] as const)("rejects %s", (_, count, unit, time) => {
    expect(intervalParts(count, unit, time)).toBeNull();
  });
});

describe("describeSchedule", () => {
  const resolved = new Map([
    [QuartzSchedulePreset.Daily, "0 0 0 * * ?"],
    [QuartzSchedulePreset.Weekly, "0 0 0 ? * SUN"],
  ]);

  function echoFor(input: Partial<ScheduleEchoInput>) {
    return describeSchedule({
      mode: QuartzSchedulePreset.None,
      interval: null,
      cronByPreset: resolved,
      customCron: null,
      ...input,
    });
  }

  it.each([
    [QuartzSchedulePreset.None, "pamRotationScheduleEchoNone"],
    [QuartzSchedulePreset.Daily, "pamRotationScheduleEchoDaily"],
    [QuartzSchedulePreset.Weekly, "pamRotationScheduleEchoWeekly"],
  ])("describes the %s preset", (mode, key) => {
    expect(echoFor({ mode })).toEqual({ key });
  });

  it("says nothing about a named preset before its expression resolves", () => {
    expect(echoFor({ mode: QuartzSchedulePreset.Monthly })).toBeNull();
  });

  it("describes the None preset before any expression resolves", () => {
    expect(echoFor({ mode: QuartzSchedulePreset.None, cronByPreset: new Map() })).toEqual({
      key: "pamRotationScheduleEchoNone",
    });
  });

  it.each([
    [interval(7, Days, 2, 0), { key: "pamRotationScheduleEchoIntervalDays", p1: 7, p2: "02:00" }],
    [interval(1, Days, 0, 0), { key: "pamRotationScheduleEchoIntervalDay", p1: "00:00" }],
    [
      interval(3, Months, 2, 0),
      { key: "pamRotationScheduleEchoIntervalMonths", p1: 3, p2: "02:00" },
    ],
    [interval(1, Months, 6, 45), { key: "pamRotationScheduleEchoIntervalMonth", p1: "06:45" }],
  ])("describes %o", (parts, echo) => {
    expect(echoFor({ mode: SCHEDULE_INTERVAL_MODE, interval: parts })).toEqual(echo);
  });

  it("says nothing about an incomplete interval", () => {
    expect(echoFor({ mode: SCHEDULE_INTERVAL_MODE, interval: null })).toBeNull();
  });

  it("echoes a custom expression verbatim", () => {
    expect(echoFor({ mode: QuartzSchedulePreset.Custom, customCron: "0 0 */4 * * ?" })).toEqual({
      key: "pamRotationScheduleEchoCustom",
      p1: "0 0 */4 * * ?",
    });
  });

  it("says nothing without a usable custom expression", () => {
    expect(echoFor({ mode: QuartzSchedulePreset.Custom, customCron: null })).toBeNull();
  });
});
