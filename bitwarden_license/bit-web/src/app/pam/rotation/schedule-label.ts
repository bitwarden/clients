import { QuartzSchedulePreset } from "./rotation";

/**
 * Reading a Quartz schedule back to a person.
 *
 * The decoding the schedule input does to load an expression into its interval builder is the
 * same decoding the managed credentials table needs to describe one, so it lives here and both
 * use it. Neither renders a raw expression as a label: an expression is how a schedule is
 * written down, not what it says.
 */

/** The units the interval builder can step. Quartz steps day-of-month and month; not weeks. */
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

export const MAX_HOUR = 23;
export const MAX_MINUTE = 59;

/** `<input type="time">` emits "HH:MM"; seconds are accepted and dropped. */
export const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** A bare or zero-padded cron clock field, or `null` when it is not a number within `max`. */
export function clockField(field: string, max: number): number | null {
  if (!/^\d{1,2}$/.test(field)) {
    return null;
  }
  const value = Number(field);
  return value <= max ? value : null;
}

/** The step `N` a `*` or `1/N` cron field carries, or `null` when it is neither or out of range. */
export function intervalStep(field: string, unit: ScheduleIntervalUnit): number | null {
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

/** A clock reading as `<input type="time">` and the SDK's presets both spell it: zero-padded. */
export function timeOfDay(hh: number, mm: number): string {
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** A repeat the interval builder can hold: every `count` `unit`, at `time`. */
export type ScheduleInterval = {
  count: number;
  unit: ScheduleIntervalUnit;
  time: string;
};

/** The builder's controls for an expression it could have produced, or `null`. */
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
  const time = timeOfDay(hh, mm);

  if (month === "*") {
    if (dom === "1") {
      return { count: 1, unit: ScheduleIntervalUnit.Months, time };
    }
    const count = intervalStep(dom, ScheduleIntervalUnit.Days);
    return count == null ? null : { count, unit: ScheduleIntervalUnit.Days, time };
  }
  if (dom !== "1") {
    return null;
  }
  const count = intervalStep(month, ScheduleIntervalUnit.Months);
  return count == null || count === 1 ? null : { count, unit: ScheduleIntervalUnit.Months, time };
}

/** Preset → its short label, the one a table column has room for. */
const PRESET_LABEL_KEYS: Readonly<Record<QuartzSchedulePreset, string>> = Object.freeze({
  [QuartzSchedulePreset.None]: "pamRotationScheduleNone",
  [QuartzSchedulePreset.Hourly]: "pamRotationScheduleHourly",
  [QuartzSchedulePreset.Every6Hours]: "pamRotationScheduleEvery6Hours",
  [QuartzSchedulePreset.Daily]: "pamRotationScheduleDaily",
  [QuartzSchedulePreset.Weekly]: "pamRotationScheduleWeekly",
  [QuartzSchedulePreset.Monthly]: "pamRotationScheduleMonthly",
  [QuartzSchedulePreset.Custom]: "pamRotationScheduleCustom",
});

/**
 * Interval unit → the short column labels.
 *
 * Shorter than the schedule input's echo sentences: the echo has a paragraph's room beneath the
 * control and says "Rotates every 3 days, at 03:00.", where a column cell has one line and says
 * "Every 3 days at 03:00".
 */
const INTERVAL_COLUMN_KEYS: Readonly<Record<ScheduleIntervalUnit, { one: string; many: string }>> =
  Object.freeze({
    [ScheduleIntervalUnit.Days]: {
      one: "pamRotationScheduleColumnEveryDay",
      many: "pamRotationScheduleColumnEveryNDays",
    },
    [ScheduleIntervalUnit.Months]: {
      one: "pamRotationScheduleColumnEveryMonth",
      many: "pamRotationScheduleColumnEveryNMonths",
    },
  });

/** A resolved schedule label: one message key, its substitutions, and the cron behind it. */
export type ScheduleLabel = {
  /** i18n key of the label. Always set, so a cell is never blank. */
  key: string;
  /** The `$1`, `$2` substitutions {@link key} takes, in order. Empty when it takes none. */
  placeholders: readonly string[];
  /**
   * The expression the label could not spell out, for a tooltip, or `null` when it could.
   *
   * Only a hand-written expression sets this: an operator who wrote one still needs to see it,
   * and "Custom" alone would lose it.
   */
  rawCron: string | null;
};

function simpleLabel(key: string): ScheduleLabel {
  return { key, placeholders: [], rawCron: null };
}

/**
 * Resolve a schedule to the label that describes it.
 *
 * Order of resolution:
 * 1. A preset the SDK named wins, and renders as that preset's short label.
 * 2. Failing that, an expression the interval builder could have composed renders as the interval
 *    it describes, with its count and time of day.
 * 3. Failing that, the expression is hand-written: it renders as "Custom" and travels on in
 *    {@link ScheduleLabel.rawCron} for a tooltip.
 *
 * An absent expression is no schedule whatever preset accompanies it, since nothing will run.
 *
 * @param preset - The preset the SDK matched this config's expression to.
 * @param cron - The config's Quartz expression, if it has one.
 */
export function resolveScheduleLabel(
  preset: QuartzSchedulePreset,
  cron: string | null | undefined,
): ScheduleLabel {
  const expression = cron?.trim() ?? "";

  // Typed wider than the table, so a preset the SDK adds ahead of this table decodes its cron
  // rather than resolving to a blank key.
  const presetKey: string | undefined = PRESET_LABEL_KEYS[preset];
  if (preset !== QuartzSchedulePreset.Custom && presetKey != null) {
    return simpleLabel(presetKey);
  }

  if (expression === "") {
    return simpleLabel(PRESET_LABEL_KEYS[QuartzSchedulePreset.None]);
  }

  const interval = parseIntervalCron(expression);
  if (interval != null) {
    const keys = INTERVAL_COLUMN_KEYS[interval.unit];
    return interval.count === 1
      ? { key: keys.one, placeholders: [interval.time], rawCron: null }
      : {
          key: keys.many,
          placeholders: [String(interval.count), interval.time],
          rawCron: null,
        };
  }

  return {
    key: PRESET_LABEL_KEYS[QuartzSchedulePreset.Custom],
    placeholders: [],
    rawCron: expression,
  };
}
