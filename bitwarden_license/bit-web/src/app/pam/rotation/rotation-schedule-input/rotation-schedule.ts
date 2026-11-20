import { QuartzSchedulePreset } from "../rotation";

/** The interval builder's mode value. */
export const SCHEDULE_INTERVAL_MODE = "interval" as const;

/** What the schedule select can hold: any SDK preset, or the interval builder. */
export type ScheduleMode = QuartzSchedulePreset | typeof SCHEDULE_INTERVAL_MODE;

/** Quartz can step day-of-month and month, but not weeks. */
export const ScheduleIntervalUnit = Object.freeze({
  Days: "days",
  Months: "months",
} as const);
export type ScheduleIntervalUnit = (typeof ScheduleIntervalUnit)[keyof typeof ScheduleIntervalUnit];

/** Quartz day-of-month is 1-31 and month is 1-12; `1/N` beyond those is rejected. */
export const MAX_INTERVAL_COUNT: Readonly<Record<ScheduleIntervalUnit, number>> = Object.freeze({
  [ScheduleIntervalUnit.Days]: 31,
  [ScheduleIntervalUnit.Months]: 12,
});

const MAX_HOUR = 23;
const MAX_MINUTE = 59;

/** `<input type="time">` emits "HH:MM"; seconds are accepted and dropped. */
const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** Every `count` days or months, at `hh:mm`. */
export interface ScheduleInterval {
  count: number;
  unit: ScheduleIntervalUnit;
  hh: number;
  mm: number;
}

/** A bare or zero-padded cron clock field, or `null` when it is not a number within `max`. */
function clockField(field: string, max: number): number | null {
  if (!/^\d{1,2}$/.test(field)) {
    return null;
  }
  const value = Number(field);
  return value <= max ? value : null;
}

/** The step `N` a `*` or `1/N` cron field carries, or `null` when it is neither or out of range. */
function intervalStep(field: string, unit: ScheduleIntervalUnit): number | null {
  if (field === "*") {
    return 1;
  }
  const match = /^1\/(\d{1,2})$/.exec(field);
  if (match == null) {
    return null;
  }
  const step = Number(match[1]);
  return step >= 1 && step <= MAX_INTERVAL_COUNT[unit] ? step : null;
}

/** Zero-padded, as `<input type="time">` and the SDK's presets spell it. */
export function timeOfDay(hh: number, mm: number): string {
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** The interval the builder's raw values describe, or `null` when they cannot make an expression. */
export function intervalParts(
  count: number | null,
  unit: ScheduleIntervalUnit,
  time: string,
): ScheduleInterval | null {
  if (count == null || !Number.isInteger(count) || count < 1 || count > MAX_INTERVAL_COUNT[unit]) {
    return null;
  }
  const match = TIME_OF_DAY.exec(time.trim());
  if (match == null) {
    return null;
  }
  const hh = clockField(match[1], MAX_HOUR);
  const mm = clockField(match[2], MAX_MINUTE);
  if (hh == null || mm == null) {
    return null;
  }
  return { count, unit, hh, mm };
}

export function composeIntervalCron({ count, unit, hh, mm }: ScheduleInterval): string {
  const step = count === 1 ? "*" : `1/${count}`;
  return unit === ScheduleIntervalUnit.Months
    ? `0 ${mm} ${hh} 1 ${step} ?`
    : `0 ${mm} ${hh} ${step} * ?`;
}

/** The interval for an expression {@link composeIntervalCron} could have produced, or `null`. */
export function parseIntervalCron(cron: string): ScheduleInterval | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 6) {
    return null;
  }
  const [second, minute, hour, dom, month, dow] = fields;
  if (second !== "0" || dow !== "?") {
    return null;
  }
  const hh = clockField(hour, MAX_HOUR);
  const mm = clockField(minute, MAX_MINUTE);
  if (hh == null || mm == null) {
    return null;
  }

  if (month === "*") {
    if (dom === "1") {
      return { count: 1, unit: ScheduleIntervalUnit.Months, hh, mm };
    }
    const count = intervalStep(dom, ScheduleIntervalUnit.Days);
    return count == null ? null : { count, unit: ScheduleIntervalUnit.Days, hh, mm };
  }
  if (dom !== "1") {
    return null;
  }
  const count = intervalStep(month, ScheduleIntervalUnit.Months);
  return count == null || count === 1 ? null : { count, unit: ScheduleIntervalUnit.Months, hh, mm };
}

/** Preset → the key of the sentence describing what it does. */
const SCHEDULE_ECHO_KEYS: Partial<Record<QuartzSchedulePreset, string>> = {
  [QuartzSchedulePreset.None]: "pamRotationScheduleEchoNone",
  [QuartzSchedulePreset.Hourly]: "pamRotationScheduleEchoHourly",
  [QuartzSchedulePreset.Every6Hours]: "pamRotationScheduleEchoEvery6Hours",
  [QuartzSchedulePreset.Daily]: "pamRotationScheduleEchoDaily",
  [QuartzSchedulePreset.Weekly]: "pamRotationScheduleEchoWeekly",
  [QuartzSchedulePreset.Monthly]: "pamRotationScheduleEchoMonthly",
};

const INTERVAL_ECHO_KEYS: Readonly<Record<ScheduleIntervalUnit, { one: string; many: string }>> =
  Object.freeze({
    [ScheduleIntervalUnit.Days]: {
      one: "pamRotationScheduleEchoIntervalDay",
      many: "pamRotationScheduleEchoIntervalDays",
    },
    [ScheduleIntervalUnit.Months]: {
      one: "pamRotationScheduleEchoIntervalMonth",
      many: "pamRotationScheduleEchoIntervalMonths",
    },
  });

/** An i18n key and its parameters. */
export interface ScheduleEcho {
  key: string;
  p1?: string | number;
  p2?: string | number;
}

export interface ScheduleEchoInput {
  mode: ScheduleMode;
  /** The builder's interval, or `null` when it cannot make an expression. */
  interval: ScheduleInterval | null;
  /** The named presets' expressions resolved so far. */
  cronByPreset: ReadonlyMap<QuartzSchedulePreset, string>;
  /** A well-shaped custom expression, or `null` when it is empty or malformed. */
  customCron: string | null;
}

/**
 * The plain-English sentence for a schedule, or `null` for an incomplete builder, an unresolved
 * preset, or no usable custom expression.
 */
export function describeSchedule({
  mode,
  interval,
  cronByPreset,
  customCron,
}: ScheduleEchoInput): ScheduleEcho | null {
  if (mode === SCHEDULE_INTERVAL_MODE) {
    if (interval == null) {
      return null;
    }
    const keys = INTERVAL_ECHO_KEYS[interval.unit];
    const time = timeOfDay(interval.hh, interval.mm);
    return interval.count === 1
      ? { key: keys.one, p1: time }
      : { key: keys.many, p1: interval.count, p2: time };
  }
  const key = SCHEDULE_ECHO_KEYS[mode];
  if (key != null) {
    return mode === QuartzSchedulePreset.None || cronByPreset.has(mode) ? { key } : null;
  }
  return customCron == null ? null : { key: "pamRotationScheduleEchoCustom", p1: customCron };
}
